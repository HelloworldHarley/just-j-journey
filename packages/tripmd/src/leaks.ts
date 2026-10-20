import type { Trip } from '@jjj/schema'
import type { Secret } from './sanitize.ts'
import { formatLatLng } from './values.ts'

/**
 * 抹净断言 —— 拿 sanitize 报出来的黑名单，在**重新解析出来的公开版 Trip** 里逐个字段找。
 *
 * 扫对象而不是扫文本：序列化会给带引号、反斜杠的值加转义，文本里就对不上了；而对象里每个字符串
 * 都知道自己是哪个字段，命中时能直接说出位置（「Day 3 ·「出发」· notes」），也能分清结构字段与正文。
 * 只扫作者写的字：id、指针、日期时刻、枚举、时区（MACHINE_FIELDS）不扫 —— 它们由名字派生或不是人写的，
 * 名字本身另有一份在扫；扫它们只会撞出作者改不掉的误报（时区 Asia/Tokyo 撞上被藏的 Tokyo）。
 *
 * 致命与提醒：
 * - 正文（PROSE_FIELDS）里命中只提醒：正文按设计不抹，那是作者写给读者的话
 * - 结构字段里命中，且值足够特异 → 致命：带数字的编号（DL7、36C、PVG T1）、够长的文字（门牌、备注）、金额原文、精确坐标
 * - 不够特异的只提醒：三四个字母或两个汉字的短词（SEA、上海 —— 撞上「SEA Airport」「上海菜」很正常）、
 *   金额里抠出来的裸数字（5000 撞上当场的套餐价很正常）、硬约束的自由文本（loose）
 * 宁可提醒不误杀：致命会挡住构建，而作者未必改得掉那一处。
 *
 * 比对前统一写法：全角半角、大小写、连续空白；编号另按去掉空白比一遍（DL 167 = dl167），数字按边界匹配
 * （票价 758 不算出现在坐标 135.7588 里）。
 */
export interface Leak {
  /** 命中的黑名单值（完整版里的原文） */
  value: string
  /** 它在完整版里的出处 */
  source: string
  /** 它在公开版里出现的位置 */
  where: string
  /** 出现在结构字段里、且值足够特异 → 构建失败 */
  fatal: boolean
}

/** 作者的正文：按设计不抹，命中只提醒。路径上带其中任一个键的字符串都算正文 */
export const PROSE_FIELDS: ReadonlySet<string> = new Set([
  'title',
  'subtitle',
  'destination',
  'summary',
  'detail',
  'variants',
  'intro',
  'markdown',
])

/** 不是作者写的字：id 与指针（由名字派生）、日期时刻、枚举、颜色、时区、几何。不扫 */
const MACHINE_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'placeId',
  'afterEventId',
  'pickupPlaceId',
  'dropoffPlaceId',
  'detailRef',
  'timezone',
  'currency',
  'visibility',
  'dates',
  'date',
  'weekday',
  'sunrise',
  'sunset',
  'depDate',
  'depTime',
  'arrDate',
  'arrTime',
  'timeRaw',
  'timeKind',
  'mode',
  'category',
  'flags',
  'hide',
  'color',
  'geo',
  'geometry',
  'icon',
])
/** 一天里的路：两端是地点 id，不是作者写的字 */
const LEG_POINTERS: ReadonlySet<string> = new Set(['from', 'to'])
const NONE: ReadonlySet<string> = new Set()

/** 比对用的统一写法：全角转半角、小写、连续空白并成一个空格 */
export function scanForm(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}
const compact = (form: string): string => form.replace(/ /g, '')

/** 宽度：汉字等全角字符算 2 —— 两个汉字（「上海」）的特异性和四个字母相当 */
function width(s: string): number {
  let w = 0
  for (const ch of s) w += ch.codePointAt(0)! > 0x2e7f ? 2 : 1
  return w
}
/** 太短的片段（「5A」「T2」）到处都撞，不进黑名单 */
const MIN_WIDTH = 3
/** 够特异才致命：带数字的编号，或足够长的文字 */
const specific = (form: string): boolean => width(form) >= 5 || /\d/.test(form)

/** 编号的复合写法：「DL281 · DL167」「KE 882 / KE 41」 */
const CODE_SEPARATORS = /[·・,，、/|;；]+/
/** 金额里有特异性的那个数：带小数的，或至少三位的整数（逗号分组照收） */
const MONEY_NUMBER = /\d[\d,]*\.\d+|\d[\d,]{2,}/

interface Needle {
  form: string
  /** 编号：另按去掉空白比一遍 */
  code: boolean
  /** 结构字段里命中算致命 */
  strict: boolean
  secret: Secret
}

function needles(secrets: readonly Secret[]): Needle[] {
  const out: Needle[] = []
  const add = (raw: string, secret: Secret, loose = false): void => {
    const form = scanForm(raw)
    if (width(form) < MIN_WIDTH) return
    const strict = !loose && !(secret.kind !== 'coord' && secret.loose) && specific(form)
    out.push({ form, code: secret.kind === 'code', strict, secret })
  }
  for (const s of secrets) {
    if (s.kind === 'coord') {
      add(formatLatLng(s.coord), s)
      continue
    }
    add(s.value, s)
    if (s.kind === 'code') for (const part of s.value.split(CODE_SEPARATORS)) add(part, s)
    if (s.kind === 'money') {
      const n = MONEY_NUMBER.exec(scanForm(s.value))?.[0]
      if (n) {
        add(n, s, true)
        add(n.replace(/,/g, ''), s, true)
      }
    }
  }
  return out
}

const ALNUM = /[a-z0-9]/
const DIGIT = /[0-9]/

/**
 * 有边界的包含：片段两头是字母数字时，紧挨着的也不能是字母数字；两头是数字时，
 * 也不能是「小数点 / 千分位 + 数字」—— 758 不算出现在 135.7588 里，48j 不算出现在 148j 里
 */
function containsBounded(hay: string, needle: string): boolean {
  const first = needle[0]!
  const last = needle[needle.length - 1]!
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) {
    const before = hay[i - 1] ?? ''
    const after = hay[i + needle.length] ?? ''
    if (ALNUM.test(first) && ALNUM.test(before)) continue
    if (ALNUM.test(last) && ALNUM.test(after)) continue
    if (DIGIT.test(first) && /[.,]/.test(before) && DIGIT.test(hay[i - 2] ?? '')) continue
    if (DIGIT.test(last) && /[.,]/.test(after) && DIGIT.test(hay[i + needle.length + 1] ?? '')) continue
    return true
  }
  return false
}

function hit(text: string, n: Needle): boolean {
  if (containsBounded(text, n.form)) return true
  return n.code && containsBounded(compact(text), compact(n.form))
}

/** 列表里每一项怎么称呼 —— 报错位置要让作者一眼找到，而不是 days[2].events[0] */
const ITEM_LABEL: Record<string, (item: Record<string, unknown>, i: number) => string> = {
  days: (d) => `Day ${String(d['index'])}`,
  events: (e) => `「${String(e['title'])}」`,
  legs: (_, i) => `第 ${i + 1} 段路`,
  journeys: (j) => `长途「${String(j['what'])}」`,
  transports: (_, i) => `第 ${i + 1} 条交通`,
  stays: (s) => `住宿「${String(s['what'])}」`,
  rentals: (r) => `租车「${String(r['what'])}」`,
  places: (p) => `地点「${String(p['name'])}」`,
  reference: (r) => `附录「${String(r['title'])}」`,
}

interface Field {
  text: string
  where: string
  prose: boolean
}

/** 公开版里作者写的每个字符串字段，带位置与是否正文；坐标另收 */
function fields(trip: Trip): { strings: Field[]; coords: { coord: [number, number]; where: string }[] } {
  const strings: Field[] = []
  const coords: { coord: [number, number]; where: string }[] = []
  const visit = (v: unknown, path: string[], prose: boolean, skip: ReadonlySet<string>): void => {
    if (typeof v === 'string') {
      strings.push({ text: scanForm(v), where: path.join(' · '), prose })
    } else if (Array.isArray(v)) {
      const key = path[path.length - 1] ?? ''
      const label = ITEM_LABEL[key]
      const childSkip = key === 'legs' ? LEG_POINTERS : NONE
      v.forEach((item, i) => {
        const name = label && item && typeof item === 'object' ? label(item as Record<string, unknown>, i) : `${key}[${i}]`
        visit(item, [...path.slice(0, -1), name], prose, childSkip)
      })
    } else if (v && typeof v === 'object') {
      for (const [k, child] of Object.entries(v)) {
        if (k === 'coord' && Array.isArray(child) && child.length === 2) {
          coords.push({ coord: child as [number, number], where: [...path, k].join(' · ') })
          continue
        }
        if (MACHINE_FIELDS.has(k) || skip.has(k)) continue
        // 住宿 / 租车的起止时刻（{raw, date, minute}）：日期时刻，不是作者的话
        if ((k === 'from' || k === 'to') && child && typeof child === 'object') continue
        visit(child, [...path, k], prose || PROSE_FIELDS.has(k), NONE)
      }
    }
  }
  visit(trip, [], false, NONE)
  return { strings, coords }
}

export function findLeaks(publicTrip: Trip, secrets: readonly Secret[]): Leak[] {
  const list = needles(secrets)
  const { strings, coords } = fields(publicTrip)
  // 同一处、同一个值只报一次；同一个值既有宽松又有严格的来源时按严格的算（硬约束里恰好也写了班次号，不能把它降成提醒）
  const leaks = new Map<string, Leak>()
  const report = (secret: Secret, where: string, fatal: boolean): void => {
    const value = secret.kind === 'coord' ? formatLatLng(secret.coord) : secret.value
    const key = `${where}\u0000${value}`
    const seen = leaks.get(key)
    if (!seen) leaks.set(key, { value, source: secret.source, where, fatal })
    else if (fatal && !seen.fatal) leaks.set(key, { value, source: secret.source, where, fatal })
  }
  for (const f of strings) {
    for (const n of list) if (hit(f.text, n)) report(n.secret, f.where, n.strict && !f.prose)
  }
  for (const c of coords) {
    for (const s of secrets) {
      if (s.kind === 'coord' && Math.abs(s.coord[0] - c.coord[0]) < 1e-9 && Math.abs(s.coord[1] - c.coord[1]) < 1e-9) {
        report(s, c.where, true)
      }
    }
  }
  return [...leaks.values()]
}
