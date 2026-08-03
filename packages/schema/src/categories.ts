/**
 * 类别系统 · 两层分组 + 一层正交状态
 *
 *   第一层 族 (Kind)       → 决定颜色与筛选归属。五个：玩 / 吃 / 住 / 行 / 事务
 *   第二层 类型 (Category) → 决定图标与两字标签。18 个类型，挂在五族下
 *   正交层 状态 (Flag)     → 决定边框与角标，不占用颜色
 *
 * 为什么颜色只给到族而不给每个类型：
 * 十八个色相平级排在一屏里，谁都不突出，等于没有分类。
 * 收到五个之后，扫一眼颜色就知道「今天几件玩的、几顿饭、多少在赶路」。
 * 细分靠图标与两字类型标签承载，信息一点没丢。
 *
 * icon 存 lucide 图标名而非组件 —— 本包不依赖 React。
 */

export const GROUP_KEYS = ['play', 'food', 'other'] as const
export type GroupKey = (typeof GROUP_KEYS)[number]

// ── 族：颜色与筛选的单位 ────────────────────────────────────────

export const KIND_KEYS = ['play', 'food', 'stay', 'move', 'misc'] as const
export type KindKey = (typeof KIND_KEYS)[number]

export interface KindDef {
  zh: string
  hint: string
  /**
   * 前端注入的 CSS 变量名（配套还有 `-dark` 后缀）。
   * null = 无色 —— 事务用透明底，不跟玩吃住行抢注意力。
   * 玩/吃取自 GROUPS，住/行取自 ACCENTS，全部可被用户自定义覆盖。
   */
  cssVar: string | null
}

export const KINDS: Record<KindKey, KindDef> = {
  play: { zh: '玩', hint: '你专程为它来的事', cssVar: '--g-play' },
  food: { zh: '吃', hint: '一日三餐的骨架', cssVar: '--g-food' },
  stay: { zh: '住', hint: '落脚的地方', cssVar: '--a-stay' },
  move: { zh: '行', hint: '位移：航班 / 火车 / 自驾…', cssVar: '--a-move' },
  misc: { zh: '事务', hint: '提还车、补货、寄存这类杂务', cssVar: null },
}

export interface GroupDef {
  zh: string
  /** 一句话说清这组是什么 */
  hint: string
  color: string
  colorDark: string
  /** solid = 实心圆片（重点）；outline = 描边圆片（退到背景） */
  fill: 'solid' | 'outline'
}

/**
 * 默认配色。绿=玩、桃红=吃，跟 Google 地图的习惯对齐。
 *
 * 这是**默认值**，不是硬编码 —— 前端会把它注入成 CSS 变量，
 * 将来首页的设置面板只要覆盖变量即可换色，组件一行不用改。
 */
export const GROUPS: Record<GroupKey, GroupDef> = {
  play: {
    zh: '玩',
    hint: '你专程为它来的事',
    // 彩度刻意提到与桃红相当（OKLCH C≈0.14 vs 0.19）。
    // 更暗淡的绿在同尺寸下会显得比桃红「窄」—— 高彩度色块视觉上更占地方。
    color: '#0E9160',
    colorDark: '#4FC58C',
    fill: 'solid',
  },
  food: {
    zh: '吃',
    hint: '一日三餐的骨架',
    // 桃红而非橙红 —— 必须和「注意」的警告红（#C0392B）拉开，
    // 否则一个粉圆片和一个红标签在小尺寸下会被读成同一类信号
    color: '#D6407C',
    colorDark: '#F58CB4',
    fill: 'solid',
  },
  // 位移和杂务用描边而非实心 —— 它们是必要的，但不该跟"玩"抢注意力
  other: {
    zh: '其他',
    hint: '位移与事务',
    color: '#6B7684',
    colorDark: '#9AA5B3',
    fill: 'outline',
  },
}

export const CATEGORY_KEYS = [
  // 玩
  'sight',
  'outdoor',
  'viewpoint',
  'experience',
  // 吃
  'food',
  'cafe',
  'snack',
  'bar',
  // 住
  'hotel',
  'homestay',
  // 行
  'flight',
  'rail',
  'hsr',
  'ferry',
  'drive',
  'bus',
  'transit',
  // 事务
  'logistics',
] as const

export type CategoryKey = (typeof CATEGORY_KEYS)[number]

export interface CategoryDef {
  /** 两字类型标签，卡片第一行 [图标][类型][名称] 里的那个类型 */
  zh: string
  kind: KindKey
  /** lucide-react 图标名，与类型一一对应 */
  icon: string
}

export const CATEGORIES: Record<CategoryKey, CategoryDef> = {
  sight: { zh: '景点', kind: 'play', icon: 'Landmark' },
  outdoor: { zh: '户外', kind: 'play', icon: 'Mountain' },
  viewpoint: { zh: '观景', kind: 'play', icon: 'Sunset' },
  experience: { zh: '体验', kind: 'play', icon: 'Ticket' },

  food: { zh: '餐厅', kind: 'food', icon: 'UtensilsCrossed' },
  cafe: { zh: '咖啡', kind: 'food', icon: 'Coffee' },
  snack: { zh: '小吃', kind: 'food', icon: 'CakeSlice' },
  bar: { zh: '酒吧', kind: 'food', icon: 'Wine' },

  hotel: { zh: '酒店', kind: 'stay', icon: 'Hotel' },
  homestay: { zh: '民宿', kind: 'stay', icon: 'House' },

  flight: { zh: '航班', kind: 'move', icon: 'Plane' },
  rail: { zh: '火车', kind: 'move', icon: 'TrainFront' },
  hsr: { zh: '高铁', kind: 'move', icon: 'TrainFrontTunnel' },
  ferry: { zh: '航运', kind: 'move', icon: 'Ship' },
  drive: { zh: '自驾', kind: 'move', icon: 'CarFront' },
  bus: { zh: '巴士', kind: 'move', icon: 'Bus' },
  transit: { zh: '通勤', kind: 'move', icon: 'TramFront' },

  logistics: { zh: '事务', kind: 'misc', icon: 'ClipboardList' },
}

/** 族 → 该族下的类型，给图例和筛选用 */
export const CATEGORIES_BY_KIND: Record<KindKey, CategoryKey[]> = {
  play: CATEGORY_KEYS.filter((k) => CATEGORIES[k].kind === 'play'),
  food: CATEGORY_KEYS.filter((k) => CATEGORIES[k].kind === 'food'),
  stay: CATEGORY_KEYS.filter((k) => CATEGORIES[k].kind === 'stay'),
  move: CATEGORY_KEYS.filter((k) => CATEGORIES[k].kind === 'move'),
  misc: CATEGORY_KEYS.filter((k) => CATEGORIES[k].kind === 'misc'),
}

export function kindOf(category: CategoryKey): KindKey {
  return CATEGORIES[category].kind
}

/**
 * 族 → 三分组（玩/吃/其他）。预算聚合、首页竖条、日程轨这些
 * 「构成占比」视图仍用三分 —— 五种颜色的堆叠条反而读不出来。
 */
export function groupKeyOf(category: CategoryKey): GroupKey {
  const k = CATEGORIES[category].kind
  return k === 'play' || k === 'food' ? k : 'other'
}

/**
 * 别名表 —— LLM 不会永远吐出规范枚举值。
 * 与其让它们报错，不如接住常见同义词。规范里明确写出接受哪些。
 */
export const CATEGORY_ALIASES: Record<string, CategoryKey> = {
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

/** 解析用户/LLM 写的类别值。返回 null 表示无法识别。 */
export function resolveCategory(raw: string): CategoryKey | null {
  const k = raw.trim().toLowerCase().replace(/[\s_-]+/g, '')
  if ((CATEGORY_KEYS as readonly string[]).includes(k)) return k as CategoryKey
  return CATEGORY_ALIASES[k] ?? null
}

// ── 正交层：状态 ────────────────────────────────────────────────

/**
 * 作者可写的状态。
 *
 * 注意这里**没有 starred**。「收藏」是用户自己在界面上点出来的，
 * 不由作者预先指定 —— 否则 Agent 读回来的"用户收藏"其实是它上次自己写的建议，
 * 这个信号就失去意义了。收藏单独存，见 web 端的 useFavorites。
 */
export const FLAG_KEYS = ['warning', 'tentative', 'optional', 'needs-booking'] as const

export type FlagKey = (typeof FLAG_KEYS)[number]

export const FLAGS: Record<FlagKey, { zh: string; hint: string }> = {
  warning: { zh: '注意', hint: '有坑，读正文' },
  tentative: { zh: '待定', hint: '还没定下来' },
  optional: { zh: '可砍', hint: '赶不上可砍' },
  'needs-booking': { zh: '待订', hint: '出发前必办' },
}

export const FLAG_ALIASES: Record<string, FlagKey> = {
  warn: 'warning',
  caution: 'warning',
  tbd: 'tentative',
  unconfirmed: 'tentative',
  booking: 'needs-booking',
  needsbooking: 'needs-booking',
  reserve: 'needs-booking',
}

export function resolveFlag(raw: string): FlagKey | null {
  const k = raw.trim().toLowerCase().replace(/[\s_]+/g, '')
  const dashed = k.replace(/([a-z])(booking)/, '$1-$2')
  if ((FLAG_KEYS as readonly string[]).includes(dashed)) return dashed as FlagKey
  if ((FLAG_KEYS as readonly string[]).includes(k)) return k as FlagKey
  return FLAG_ALIASES[k.replace(/-/g, '')] ?? null
}

// ── 交通方式 ────────────────────────────────────────────────────

export const TRANSPORT_MODES = [
  'walk',
  'drive',
  'rideshare',
  'rail',
  'hsr',
  'bus',
  'monorail',
  'streetcar',
  'ferry',
  'flight',
  'bike',
] as const

export type TransportMode = (typeof TRANSPORT_MODES)[number]

export interface TransportDef {
  zh: string
  icon: string
  /** 能否用 OSRM 算出真实路网轨迹。false → 地图上画虚线弧 */
  routable: boolean
  gmaps: 'walking' | 'driving' | 'transit' | 'bicycling'
  apple: 'w' | 'd' | 'r'
}

export const TRANSPORTS: Record<TransportMode, TransportDef> = {
  walk: { zh: '步行', icon: 'Footprints', routable: true, gmaps: 'walking', apple: 'w' },
  drive: { zh: '自驾', icon: 'Car', routable: true, gmaps: 'driving', apple: 'd' },
  rideshare: { zh: '打车', icon: 'CarTaxiFront', routable: true, gmaps: 'driving', apple: 'd' },
  rail: { zh: '轨道', icon: 'TrainFront', routable: false, gmaps: 'transit', apple: 'r' },
  hsr: { zh: '高铁', icon: 'TrainFrontTunnel', routable: false, gmaps: 'transit', apple: 'r' },
  bus: { zh: '公交', icon: 'Bus', routable: false, gmaps: 'transit', apple: 'r' },
  monorail: { zh: '单轨', icon: 'TramFront', routable: false, gmaps: 'transit', apple: 'r' },
  streetcar: { zh: '电车', icon: 'TramFront', routable: false, gmaps: 'transit', apple: 'r' },
  ferry: { zh: '轮渡', icon: 'Ship', routable: false, gmaps: 'transit', apple: 'r' },
  flight: { zh: '飞行', icon: 'Plane', routable: false, gmaps: 'transit', apple: 'r' },
  bike: { zh: '骑行', icon: 'Bike', routable: true, gmaps: 'bicycling', apple: 'w' },
}

export const TRANSPORT_ALIASES: Record<string, TransportMode> = {
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

export function resolveTransport(raw: string): TransportMode | null {
  const k = raw.trim().toLowerCase().replace(/[\s_-]+/g, '')
  if ((TRANSPORT_MODES as readonly string[]).includes(k)) return k as TransportMode
  return TRANSPORT_ALIASES[k] ?? null
}

// ── 硬约束 ──────────────────────────────────────────────────────

export const CONSTRAINT_KINDS = [
  'arrive',
  'depart',
  'deadline',
  'checkin',
  'checkout',
  'reservation',
] as const

export type ConstraintKind = (typeof CONSTRAINT_KINDS)[number]

export const CONSTRAINTS: Record<ConstraintKind, { zh: string; icon: string }> = {
  // 抵达/离开与交通方式无关 —— 坐火车/自驾进城同样是 arrive
  arrive: { zh: '抵达', icon: 'PlaneLanding' },
  depart: { zh: '离开', icon: 'PlaneTakeoff' },
  deadline: { zh: '截止', icon: 'AlarmClock' },
  checkin: { zh: '入住', icon: 'LogIn' },
  checkout: { zh: '退房', icon: 'LogOut' },
  reservation: { zh: '预订', icon: 'CalendarCheck' },
}
