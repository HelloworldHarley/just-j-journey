/**
 * 类别系统 · 两层分组 + 一层正交状态
 *
 *   第一层 分组 (Group)    → 决定颜色。只有三个：玩 / 吃 / 其他
 *   第二层 类别 (Category) → 决定图标。11 个细类，挂在三个组下
 *   正交层 状态 (Flag)     → 决定边框与角标，不占用颜色
 *
 * 为什么颜色只给三个而不是给每个细类：
 * 九个色相平级排在一屏里，谁都不突出，等于没有分类。
 * 收到三个之后，扫一眼颜色就知道「今天几件玩的、几顿饭、多少在赶路」——
 * Day 4 整列青绿说明一整天都在玩，Day 1 灰青灰橙说明是个折腾日。
 * 细分靠图标承载，信息一点没丢。
 *
 * icon 存 lucide 图标名而非组件 —— 本包不依赖 React。
 */

export const GROUP_KEYS = ['play', 'food', 'other'] as const
export type GroupKey = (typeof GROUP_KEYS)[number]

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
  'bar',
  // 其他
  'flight',
  'transit',
  'lodging',
  'logistics',
] as const

export type CategoryKey = (typeof CATEGORY_KEYS)[number]

export interface CategoryDef {
  zh: string
  group: GroupKey
  /** lucide-react 图标名 */
  icon: string
}

export const CATEGORIES: Record<CategoryKey, CategoryDef> = {
  sight: { zh: '景点', group: 'play', icon: 'Landmark' },
  outdoor: { zh: '户外', group: 'play', icon: 'Mountain' },
  viewpoint: { zh: '观景', group: 'play', icon: 'Sunset' },
  experience: { zh: '体验', group: 'play', icon: 'Ticket' },

  food: { zh: '正餐', group: 'food', icon: 'UtensilsCrossed' },
  cafe: { zh: '咖啡小吃', group: 'food', icon: 'Coffee' },
  bar: { zh: '酒吧', group: 'food', icon: 'Wine' },

  flight: { zh: '航班', group: 'other', icon: 'Plane' },
  transit: { zh: '交通', group: 'other', icon: 'TrainFront' },
  lodging: { zh: '住宿', group: 'other', icon: 'BedDouble' },
  logistics: { zh: '事务', group: 'other', icon: 'KeyRound' },
}

/** 分组 → 该组下的细类，给图例和筛选用 */
export const CATEGORIES_BY_GROUP: Record<GroupKey, CategoryKey[]> = {
  play: CATEGORY_KEYS.filter((k) => CATEGORIES[k].group === 'play'),
  food: CATEGORY_KEYS.filter((k) => CATEGORIES[k].group === 'food'),
  other: CATEGORY_KEYS.filter((k) => CATEGORIES[k].group === 'other'),
}

export function groupOf(category: CategoryKey): GroupDef {
  return GROUPS[CATEGORIES[category].group]
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
  drive: 'viewpoint', // 风景自驾路段本身就是观景
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
  dessert: 'cafe',
  snack: 'cafe',
  bakery: 'cafe',
  teahouse: 'cafe',
  // → bar
  drinks: 'bar',
  pub: 'bar',
  lounge: 'bar',
  nightlife: 'bar',
  // → flight
  plane: 'flight',
  air: 'flight',
  // → transit
  transport: 'transit',
  transportation: 'transit',
  commute: 'transit',
  train: 'transit',
  bus: 'transit',
  // → lodging
  hotel: 'lodging',
  accommodation: 'lodging',
  stay: 'lodging',
  checkin: 'lodging',
  checkout: 'lodging',
  // → logistics
  admin: 'logistics',
  errand: 'logistics',
  shopping: 'logistics',
  rental: 'logistics',
  packing: 'logistics',
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
