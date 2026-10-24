import { describe, expect, it } from 'vitest'
import { sources } from './sources.ts'

/**
 * 规则归位锁：每条规则只能写在它的唯一归属里。
 *
 * 一行一条：规则在代码里长什么样（pattern，匹配去掉注释后的源码）、在哪些目录里找、唯一允许出现的文件。
 * 断言是「命中的文件 == home」—— 别处冒出副本会红，归属文件里规则被改名或搬走（锁随之失效）也会红。
 * 把一条规则归位后，在这里加一行；旧位置的副本必须先删掉，否则这一行加不进来。
 */

interface Lock {
  rule: string
  pattern: RegExp
  scope: string[]
  home: string[]
}

const ALL_CODE = ['packages', 'apps/web/src', 'apps/web/vite', 'apps/web/vite.config.ts', 'tools']

const LOCKS: Lock[] = [
  {
    rule: '是不是公开构建，浏览器端只在一处读',
    pattern: /VITE_PUBLIC/,
    scope: ['apps/web/src'],
    home: ['apps/web/src/lib/public.ts'],
  },
  {
    rule: '日期字符串交给 Date 只在 tripmd 的 UTC 锚定函数里发生',
    pattern: /new Date\(\s*[^\s)]/,
    scope: ALL_CODE,
    home: ['packages/tripmd/src/values.ts'],
  },
  {
    rule: '首次引用 / 重复提及只有一个扫描',
    pattern: /\b(function|const|let)\s+detailIndex\b/,
    scope: ALL_CODE,
    home: ['packages/tripmd/src/resolve.ts'],
  },
  {
    rule: 'detail 引用对号入座（哪张卡挂哪条前置记录）只有一处',
    pattern: /firstRef\.get\(/,
    scope: ALL_CODE,
    home: ['packages/tripmd/src/resolve.ts'],
  },
  {
    // patch.ts 也在名单里：它的 op.afterEventId 是另一回事（插入事件的锚点）；
    // 它按事件找路的那一处有 bug（审查 #13），按计划在 P4 改用 adjacentLegs
    rule: '按事件找它前后的路只有一处',
    pattern: /\.afterEventId\b/,
    scope: ALL_CODE,
    home: ['packages/tripmd/src/resolve.ts', 'packages/tripmd/src/patch.ts'],
  },
  {
    rule: '坐标的作者格式（纬度在前）只在一处拼',
    pattern: /coord\[1\]\}\s*[,;]\s*\$\{[^}]*coord\[0\]|\$\{coord\[1\]\}/,
    scope: ALL_CODE,
    home: ['packages/tripmd/src/values.ts'],
  },
  {
    rule: '民宿算不算私密只判一处',
    pattern: /category\s*[!=]==\s*'homestay'/,
    scope: ALL_CODE,
    home: ['packages/tripmd/src/sanitize.ts'],
  },
  {
    rule: '公开版的整条链只在 publicPlan 里组装（sanitize 只在那里被调用）',
    pattern: /\bsanitize\(/,
    scope: ALL_CODE,
    home: ['packages/tripmd/src/sanitize.ts', 'packages/tripmd/src/public.ts'],
  },
  {
    rule: '数据文件叫什么只在布局模块里定（其余一律用 PLAN_FILE 这些常量）',
    pattern: /['"`](plan\.md|geometry\.json|calendar\.ics|manifest\.json|space\.md|calendar\.json)['"`]/,
    scope: ALL_CODE,
    home: ['packages/tripmd/src/layout.ts'],
  },
  {
    rule: '拷贝与改名只在数据目录模块里做（真实位置越界的不拷、写入先写临时文件再改名）',
    pattern: /\b(cpSync|copyFileSync|renameSync)\b/,
    scope: ALL_CODE,
    home: ['packages/datadir/src/index.ts'],
  },
  {
    rule: '跨进程的环境变量不直接读写 process.env（名字与读法在 datadir 的 env.ts）',
    pattern: /process\.env(\.|\[['"])(JJJ_DATA_DIR|JJJ_CALENDAR_TOKEN|JJJ_DEV_HOST|VITE_PUBLIC)|\b(JJJ_DATA_DIR|VITE_PUBLIC)\s*:/,
    scope: ALL_CODE,
    home: [],
  },
  {
    rule: 'dev 端口只定义一次',
    pattern: /\b517[34]\b/,
    scope: ALL_CODE,
    home: ['apps/web/vite/dev-server.ts'],
  },
  {
    rule: '枚举怎么认（别名、中文名、退役的写法）只在词表里',
    pattern: /\b[A-Z]+_ALIASES\b/,
    scope: ALL_CODE,
    home: ['packages/tripmd/src/vocab.ts'],
  },
  {
    rule: 'YAML 只在读取层解析（带行号的 yamlOf）',
    pattern: /from\s*['"]yaml['"]/,
    scope: ALL_CODE,
    home: ['packages/tripmd/src/read.ts'],
  },
  {
    rule: '允许哪些键、拼错的键怎么报，只在字段表的 readRecord 里',
    pattern: /无法识别，已忽略/,
    scope: ALL_CODE,
    home: ['packages/tripmd/src/read.ts'],
  },
  {
    rule: 'schema 兜底关口只有 schemaGate 一个',
    pattern: /\.safeParse\(/,
    scope: ALL_CODE,
    home: ['packages/tripmd/src/read.ts'],
  },
  {
    rule: '全角转半角只定义一次',
    pattern: /\bfunction\s+normalizeText\b/,
    scope: ALL_CODE,
    home: ['packages/tripmd/src/text.ts'],
  },
  {
    rule: '只写日期时补的时刻只定义一次',
    pattern: /\bDEFAULT_MINUTE\s*=|\bDEFAULT_CHECK_(IN|OUT)\b/,
    scope: ALL_CODE,
    home: ['packages/tripmd/src/values.ts'],
  },
  {
    rule: '「是不是自带的数据目录」按真实路径比（isDefaultDataDir），不拿字符串比',
    pattern: /[!=]==\s*DEFAULT_DATA_DIR|DEFAULT_DATA_DIR\s*[!=]==/,
    scope: ALL_CODE,
    home: [],
  },
]

describe('规则只写在一处', () => {
  for (const lock of LOCKS) {
    it(lock.rule, () => {
      const hits = sources(...lock.scope)
        .filter((s) => lock.pattern.test(s.code))
        .map((s) => s.path)
      expect(hits.sort()).toEqual([...lock.home].sort())
    })
  }
})
