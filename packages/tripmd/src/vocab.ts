import {
  BookingSchema,
  CATEGORIES,
  CATEGORY_KEYS,
  CONSTRAINTS,
  CONSTRAINT_KINDS,
  FLAGS,
  FLAG_KEYS,
  PERIOD_KEYS,
  PERIOD_ZH,
  TRANSPORTS,
  TRANSPORT_ENDS,
  TRANSPORT_MODES,
  VISIBILITIES,
  type CategoryKey,
  type ConstraintKind,
  type FlagKey,
  type PeriodKey,
  type TransportEnd,
  type TransportMode,
  type Visibility,
} from '@jjj/schema'
import { suggest } from './diagnostics.ts'
import { normalizeText } from './text.ts'

/**
 * 枚举的词表 —— 作者（和 LLM）写的值 → 规范键。所有枚举走同一套：
 * 匹配前全角转半角、小写、去掉空白 / 下划线 / 连字符（`Needs Booking`、`needs_booking`、`ｎｅｅｄｓ-booking` 是同一个），
 * 认规范键、别名、以及 schema 表里的中文名（类别「景点」、约束「截止」、预订状态「已预订」……）。
 * 认不出时给「是否想写 X」。schema 只留键和中文名，「怎么认」住在这里。
 *
 * 两张表里的交通词含义不同，是有意的：**类别**回答「这张卡是哪种事」（subway / metro / tram 归「通勤」，市内交通），
 * **交通方式**回答「坐的是什么车」（subway / metro → rail，tram → streetcar）。同一个词进两张表，各取各的意思。
 */

export interface Vocab<K extends string> {
  /** 报错时叫它什么，如「category」 */
  readonly name: string
  readonly keys: readonly K[]
  /** 认得出返回规范键，认不出返回 null */
  resolve(raw: string): K | null
  /** 认不出时最像的那个，给「是否想写 X」 */
  guess(raw: string): K | null
  /** 退役的写法：认得出，但已不再使用 —— 返回给作者的说明 */
  retired(raw: string): string | null
}

/** 比对用的写法：全角转半角、小写、去掉空白下划线连字符 */
export function vocabKey(raw: string): string {
  return normalizeText(raw).toLowerCase().replace(/[\s_-]+/g, '')
}

function vocab<K extends string>(
  name: string,
  keys: readonly K[],
  aliases: Readonly<Record<string, K>>,
  labels: Partial<Readonly<Record<K, string>>> = {},
  retired: Readonly<Record<string, string>> = {},
): Vocab<K> {
  // 规范键 > 别名 > 中文名：后写的不覆盖先写的，同一个写法只指向一个键
  const byKey = new Map<string, K>()
  const add = (spelling: string, key: K): void => {
    const k = vocabKey(spelling)
    if (!byKey.has(k)) byKey.set(k, key)
  }
  for (const key of keys) add(key, key)
  for (const [spelling, key] of Object.entries(aliases)) add(spelling, key)
  for (const key of keys) {
    const zh = labels[key]
    if (zh) add(zh, key)
  }
  const retiredByKey = new Map(Object.entries(retired).map(([spelling, why]) => [vocabKey(spelling), why]))
  const spellings = [...byKey.keys()]
  return {
    name,
    keys,
    resolve: (raw) => byKey.get(vocabKey(raw)) ?? null,
    guess: (raw) => {
      const hit = suggest(vocabKey(raw), spellings)
      return hit === null ? null : (byKey.get(hit) ?? null)
    },
    retired: (raw) => retiredByKey.get(vocabKey(raw)) ?? null,
  }
}

const labelsOf = <K extends string>(table: Readonly<Record<K, { zh: string }>>): Partial<Record<K, string>> =>
  Object.fromEntries(Object.entries<{ zh: string }>(table).map(([k, v]) => [k, v.zh])) as Partial<Record<K, string>>

// ── 别名表 —— LLM 不会永远吐出规范值，接住常见同义词。规范（TRIPMD_SPEC）里写明接受哪些 ──

const CATEGORY_ALIASES: Readonly<Record<string, CategoryKey>> = {
  // → sight
  attraction: 'sight',
  sightseeing: 'sight',
  museum: 'sight',
  landmark: 'sight',
  culture: 'sight',
  temple: 'sight',
  shrine: 'sight',
  // → outdoor
  hike: 'outdoor',
  hiking: 'outdoor',
  trail: 'outdoor',
  nature: 'outdoor',
  park: 'outdoor',
  garden: 'outdoor',
  beach: 'outdoor',
  // → viewpoint
  view: 'viewpoint',
  scenic: 'viewpoint',
  sunset: 'viewpoint',
  sunrise: 'viewpoint',
  overlook: 'viewpoint',
  scenicdrive: 'viewpoint', // 风景自驾路段本身就是观景；通勤性质的自驾用 drive
  // → experience
  tour: 'experience',
  activity: 'experience',
  show: 'experience',
  entertainment: 'experience',
  spa: 'experience',
  // → food
  restaurant: 'food',
  meal: 'food',
  dining: 'food',
  breakfast: 'food',
  lunch: 'food',
  dinner: 'food',
  market: 'food',
  // → cafe
  coffee: 'cafe',
  bakery: 'cafe',
  teahouse: 'cafe',
  brunch: 'cafe',
  // → snack
  dessert: 'snack',
  streetfood: 'snack',
  icecream: 'snack',
  boba: 'snack',
  // → bar
  drinks: 'bar',
  pub: 'bar',
  lounge: 'bar',
  nightlife: 'bar',
  // → hotel
  lodging: 'hotel',
  accommodation: 'hotel',
  stay: 'hotel',
  checkin: 'hotel',
  checkout: 'hotel',
  resort: 'hotel',
  inn: 'hotel',
  motel: 'hotel',
  // → homestay
  airbnb: 'homestay',
  bnb: 'homestay',
  guesthouse: 'homestay',
  cabin: 'homestay',
  hostel: 'homestay',
  ryokan: 'homestay',
  minshuku: 'homestay',
  // → flight
  plane: 'flight',
  air: 'flight',
  airplane: 'flight',
  // → rail
  train: 'rail',
  railway: 'rail',
  amtrak: 'rail',
  // → hsr
  highspeedrail: 'hsr',
  bullettrain: 'hsr',
  bullet: 'hsr',
  shinkansen: 'hsr',
  // → ferry
  boat: 'ferry',
  ship: 'ferry',
  cruise: 'ferry',
  // → drive
  selfdrive: 'drive',
  car: 'drive',
  roadtrip: 'drive',
  rental: 'drive',
  carrental: 'drive',
  // → bus
  coach: 'bus',
  shuttle: 'bus',
  // → transit
  transport: 'transit',
  transportation: 'transit',
  commute: 'transit',
  subway: 'transit',
  metro: 'transit',
  lightrail: 'transit',
  monorail: 'transit',
  tram: 'transit',
  // → logistics
  admin: 'logistics',
  errand: 'logistics',
  shopping: 'logistics',
  packing: 'logistics',
  laundry: 'logistics',
}


const FLAG_ALIASES: Readonly<Record<string, FlagKey>> = {
  tbd: 'tentative',
  unconfirmed: 'tentative',
  booking: 'needs-booking',
  reserve: 'needs-booking',
}

const TRANSPORT_ALIASES: Readonly<Record<string, TransportMode>> = {
  walking: 'walk',
  foot: 'walk',
  onfoot: 'walk',
  car: 'drive',
  driving: 'drive',
  selfdrive: 'drive',
  taxi: 'rideshare',
  uber: 'rideshare',
  lyft: 'rideshare',
  didi: 'rideshare',
  cab: 'rideshare',
  subway: 'rail',
  metro: 'rail',
  train: 'rail',
  lightrail: 'rail',
  link: 'rail',
  shinkansen: 'hsr',
  bullettrain: 'hsr',
  highspeedrail: 'hsr',
  tram: 'streetcar',
  trolley: 'streetcar',
  boat: 'ferry',
  fly: 'flight',
  plane: 'flight',
  air: 'flight',
  cycling: 'bike',
  bicycle: 'bike',
}

const PERIOD_ALIASES: Readonly<Record<string, PeriodKey>> = {
  am: 'morning',
  forenoon: 'morning',
  pm: 'afternoon',
  noon: 'afternoon',
  eve: 'evening',
  dusk: 'evening',
  late: 'night',
  晚上: 'evening',
  夜里: 'night',
}

// ── 词表 ──

export const CATEGORY: Vocab<CategoryKey> = vocab('category', CATEGORY_KEYS, CATEGORY_ALIASES, labelsOf(CATEGORIES))

/**
 * `warning`（注意）标记已废弃（D5，2026-10-20）：它不再画任何角标，
 * 要提醒读者的事写进注意条目（notes），那里在卡片上看得见
 */
export const FLAG: Vocab<FlagKey> = vocab('flag', FLAG_KEYS, FLAG_ALIASES, labelsOf(FLAGS), {
  warning: '`warning` 标记已废弃，已忽略',
  warn: '`warning` 标记已废弃，已忽略',
  caution: '`warning` 标记已废弃，已忽略',
  注意: '`warning` 标记已废弃，已忽略',
})

export const TRANSPORT_MODE: Vocab<TransportMode> = vocab('mode', TRANSPORT_MODES, TRANSPORT_ALIASES, labelsOf(TRANSPORTS))

export const CONSTRAINT_KIND: Vocab<ConstraintKind> = vocab('kind', CONSTRAINT_KINDS, {}, labelsOf(CONSTRAINTS))

export const BOOKING_STATUS = vocab('status', BookingSchema.shape.status.options, {
  需预订: 'required',
  待订: 'required',
  已预订: 'booked',
  已订: 'booked',
  无需预订: 'none',
  不用订: 'none',
})

export const VISIBILITY: Vocab<Visibility> = vocab('visibility', VISIBILITIES, { 公开: 'public', 私有: 'private' })

export const TRANSPORT_END: Vocab<TransportEnd> = vocab('hide', TRANSPORT_ENDS, { 出发: 'from', 出发地: 'from', 到达: 'to', 到达地: 'to' })

export const PERIOD: Vocab<PeriodKey> = vocab('time', PERIOD_KEYS, PERIOD_ALIASES, PERIOD_ZH)

/** 时段关键字 / 别名 → PeriodKey。认不出返回 null */
export function resolvePeriod(raw: string): PeriodKey | null {
  return PERIOD.resolve(raw)
}
