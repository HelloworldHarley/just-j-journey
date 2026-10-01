import { execSync, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * 用 Chrome 开地址 —— 找二进制、按邮箱选 profile、判断在不在跑、决定开标签还是开窗口。
 * `pnpm look` 用；和起服务器那半边分开，这里不知道端口与路由。
 *
 * profile 按邮箱选：Chrome 的 Local State 里 `profile.info_cache[<目录>].user_name` 是登录邮箱，
 * 命中就用 `--profile-directory=<目录>` 开 —— 个人仓库用个人账号、工作仓库用工作账号，不必手选。
 * 找不到 Chrome 退回系统默认浏览器；找不到对应 profile 用上次那个。
 * 开之前先看 Chrome 在不在跑、这个 profile 有没有开着的窗口：有就在**那个窗口里加标签页**（不新开窗口），
 * 没窗口才新开一个，没在跑才启动 Chrome。
 */

export interface Browser {
  /** 打印用：会用什么、怎么开 */
  describe: string
  /** 想要的 profile 找不到时的提醒 —— 单独给出，调用方用醒目颜色打 */
  warning?: string
  /** 一次开一组地址 —— Chrome 里是同一个窗口里的几个标签 */
  open: (urls: string[]) => Promise<void>
}

export interface BrowserOptions {
  /** 想要的 profile：邮箱或 profile 目录名；不给就用上次的 */
  profile?: string | undefined
  /** 开成独立新窗口，而不是在已有窗口里加标签页 */
  newWindow: boolean
}

export function resolveBrowser({ profile: want, newWindow }: BrowserOptions): Browser {
  const chrome = chromeBinary()
  if (!chrome) {
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
    return {
      describe: `找不到 Chrome，用系统默认浏览器（${opener}）`,
      open: async (urls) => {
        for (const u of urls) spawn(opener, [u], { stdio: 'ignore', detached: true }).unref()
      },
    }
  }
  const profiles = chromeProfiles()
  const hit = want
    ? profiles.find((p) => p.dir === want || p.email.toLowerCase() === want.toLowerCase())
    : undefined
  const flags = hit ? [`--profile-directory=${hit.dir}`] : []
  const who = hit ? `${hit.email || hit.name}（${hit.dir}）` : '上次用的 profile'

  // 在跑   → 直接执行二进制：它把参数交给运行中的实例后自己退出。不带 --new-window 时 Chrome 把地址
  //          开成该 profile 最近那个窗口里的新标签页；该 profile 没窗口它自己会新开一个
  // 没在跑 → macOS 经 open -a 走 LaunchServices 正常启动（Dock 图标、焦点都对），参数首次启动能带进去
  let running = chromeRunning()
  // 没指定 profile 时 Chrome 用上次那个：它有没有窗口看 last_active_profiles 非空即可
  const windowOpen = Boolean(running && (hit ? activeProfiles().includes(hit.dir) : activeProfiles().length > 0))
  const tabOrWindow = newWindow ? '另开一个新窗口' : '在那个窗口里加标签页'
  const describe =
    running === null
      ? `Chrome · ${who}`
      : !running
        ? `Chrome 没在跑 → 用 ${who} 启动`
        : windowOpen
          ? `Chrome 已开着，${who} 有窗口 → ${tabOrWindow}`
          : `Chrome 已开着，${who} 还没开窗口 → 新开一个窗口`
  let warning: string | undefined
  if (want && !hit) {
    const known = profiles.map((p) => `${p.dir}=${p.email || p.name}`).join(', ')
    warning = `⚠ Chrome 里没有登录 ${want} 的 profile${known ? `；现有：${known}` : '；读不到 Local State'}`
  }

  const launch = async (args: string[]): Promise<void> => {
    if (running === false && process.platform === 'darwin') {
      const app = chrome.replace(/\/Contents\/MacOS\/[^/]+$/, '')
      spawn('open', ['-a', app, '--args', ...args], { stdio: 'ignore', detached: true }).unref()
      // 之后的窗口（--both 的第二个）走交接：等主进程真起来，再给它一点建立监听的时间
      running = true
      for (let waited = 0; waited < 10_000 && chromeRunning() !== true; waited += 250) await sleep(250)
      await sleep(1500)
      return
    }
    spawn(chrome, args, { stdio: 'ignore', detached: true }).unref()
  }
  return {
    describe,
    warning,
    // 缺省不带 --new-window：地址进 profile 当前窗口的新标签页；--new-window 才另开窗口
    open: (urls) => launch([...flags, ...(newWindow ? ['--new-window'] : []), ...urls]),
  }
}

/** Chrome 主进程在不在跑：macOS 主进程名就叫 Google Chrome（Helper 是别的名字，-x 精确匹配）；认不出的平台返回 null */
function chromeRunning(): boolean | null {
  const name = process.platform === 'darwin' ? 'Google Chrome' : process.platform === 'linux' ? 'chrome' : null
  if (!name) return null
  try {
    execSync(`pgrep -x "${name}"`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function chromeBinary(): string | null {
  const candidates =
    process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          join(homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
        ]
      : process.platform === 'win32'
        ? [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          ]
        : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  return candidates.find((p) => existsSync(p)) ?? null
}

interface ChromeProfile {
  dir: string
  email: string
  name: string
}

/** Chrome 的 Local State 里我们用到的两块 */
interface LocalState {
  profile?: {
    /** 以 profile 目录名为键，`user_name` 是登录邮箱 */
    info_cache?: Record<string, { user_name?: string; name?: string; gaia_name?: string }>
    /** 当前开着窗口的 profile 目录（Chrome 随开关窗口更新，落盘有几秒延迟） */
    last_active_profiles?: string[]
  }
}

function readLocalState(): LocalState | null {
  const path =
    process.platform === 'darwin'
      ? join(homedir(), 'Library/Application Support/Google/Chrome/Local State')
      : process.platform === 'win32'
        ? join(process.env['LOCALAPPDATA'] ?? '', 'Google/Chrome/User Data/Local State')
        : join(homedir(), '.config/google-chrome/Local State')
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as LocalState
  } catch {
    return null
  }
}

function chromeProfiles(): ChromeProfile[] {
  return Object.entries(readLocalState()?.profile?.info_cache ?? {}).map(([dir, p]) => ({
    dir,
    email: p.user_name ?? '',
    name: p.name ?? p.gaia_name ?? dir,
  }))
}

/** 只在 Chrome 在跑时有意义：退出后它保留的是上次的集合（供恢复会话用） */
function activeProfiles(): string[] {
  return readLocalState()?.profile?.last_active_profiles ?? []
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
