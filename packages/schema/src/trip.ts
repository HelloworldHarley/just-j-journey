import { z } from 'zod'
import { CATEGORY_KEYS, CONSTRAINT_KINDS, FLAG_KEYS, TRANSPORT_MODES } from './categories.ts'
import { TIME_KINDS } from './time.ts'

/**
 * 运行时行程 schema（trip.json）。
 *
 * 这是 **运行时格式**，不是作者格式。TripMD 是作者写的东西，
 * 解析器负责把它规范化成这里：分配 id、去重地点、把 to_next 展开成 legs、
 * 把时段关键字解析成分钟窗、把 #### 变体收进 variants。
 *
 * 前端、CLI、（将来的）后端共用本文件。改一处，三处编译期报错。
 */

const iso = /^\d{4}-\d{2}-\d{2}$/

export const CoordSchema = z.tuple([
  z.number().min(-180).max(180), // lng
  z.number().min(-90).max(90), // lat
])

export const PlaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  nameEn: z.string().optional(),
  /** [lng, lat] —— GeoJSON 顺序。作者格式里写的是 lat,lng，解析器负责调换。 */
  coord: CoordSchema.nullable(),
  category: z.enum(CATEGORY_KEYS),
  tentative: z.boolean().default(false),
  gmapsPlaceId: z.string().optional(),
  url: z.string().optional(),
  note: z.string().optional(),
  geo: z.object({
    source: z.enum(['authored', 'nominatim', 'manual', 'none']),
    confidence: z.enum(['high', 'low', 'unknown']),
    query: z.string().optional(),
  }),
})

export const VariantSchema = z.object({
  when: z.string().min(1),
  body: z.string(),
})

export const BookingSchema = z.object({
  status: z.enum(['required', 'booked', 'none']),
  deadline: z.string().regex(iso).optional(),
  note: z.string().optional(),
})

/**
 * 费用。作者写自由文本（"约 $70/人"），解析器负责抽取金额 ——
 * LLM 写自然语言最稳，结构化是解析器的责任，不是作者的。
 * 抽不出金额时 amount 为 null，原文仍在 raw 里展示，只是不进预算统计。
 */
export const CostSchema = z.object({
  /** 原文，原样展示 */
  raw: z.string(),
  /** 总金额（已乘人数）。null = 没抽出来，不进统计 */
  amount: z.number().nullable(),
  currency: z.string().optional(),
  /** 「可选」「(可选)」字样 → true，预算页里单独归一档 */
  optional: z.boolean().default(false),
})

/** 中转站/换乘点。时长未填时 UI 画等宽段并留「待填」空位。 */
export const TransportStopSchema = z.object({
  /** 中转到达点：机场/换乘站/停靠港，如 "ICN" */
  airport: z.string().optional(),
  /** 异地中转的再出发点（与 airport 不同才写，如跨站换乘） */
  depAirport: z.string().optional(),
  /** 到达该中转点的当地时间 "13:55" */
  arrTime: z.string().optional(),
  /** 从该中转点再出发的当地时间 "16:35" */
  depTime: z.string().optional(),
  /** 到达该中转点的日期。缺省按时刻回卷从出发日推算；跨日期变更线时显式写 */
  arrDate: z.string().optional(),
  /** 从该中转点再出发的日期。缺省同上 */
  depDate: z.string().optional(),
  /**
   * 到达此中转点的**前一段行进**时长（分钟）。跨时区没法从两端当地时间
   * 算出来，作者可提供；null = 未填，按全程减停留后均分
   */
  legMin: z.number().int().positive().nullable().default(null),
  /** 停留分钟数；null = 未填 */
  waitMin: z.number().int().positive().nullable().default(null),
})

/**
 * 长途换乘段 —— 抵达/离开/多目的地间的移动，机票式时间轴渲染。
 * 住在顶层 trip-transports（JourneySchema）里，事件用 detail: 引用。
 *
 * 不钉死为航班：mode 决定它是飞机、火车、自驾还是轮渡，
 * 卡片视觉相同（左起点右终点、实线行进、虚线停留），只换图标与文案。
 *
 * 多人从不同地方出发汇合时，一段长途挂多条 transport，各自带 traveler 标签。
 *
 * **所有字段可空** —— 行程常常先排好、票后买。缺的字段渲染「待填」空位，
 * 之后人工补进 TripMD 或由 Agent 填入。
 */
export const TransportSchema = z.object({
  /** 谁的行程（多人汇合时区分），如 "她" / "我"。单人可省 */
  traveler: z.string().optional(),
  /** 交通方式，决定图标与文案。默认 flight */
  mode: z.enum(TRANSPORT_MODES).default('flight'),
  /** 承运方：航司/铁路公司/船司/租车行，如 "全日空 ANA" */
  carrier: z.string().optional(),
  /** 班次号：航班号/车次/船班，如 "NH178"；多段可写 "DL281 · DL167" */
  number: z.string().optional(),
  /** 出发点：机场/车站/港口/城市，如 "PVG T2" */
  from: z.string().optional(),
  /** 到达点 */
  to: z.string().optional(),
  /**
   * 出发日期 "YYYY-MM-DD"。缺省按事件当天推算 ——
   * 抵达型事件的航班其实前一天起飞时（西行跨日期变更线）才需要显式写
   */
  depDate: z.string().optional(),
  /** 出发当地时间 "10:15" */
  depTime: z.string().optional(),
  /** 到达当地时间 "13:11" */
  arrTime: z.string().optional(),
  /** 到达日期 "YYYY-MM-DD"。缺省 = 出发日期 + arr_day_offset */
  arrDate: z.string().optional(),
  /** 到达在第几天后：0 当天，1 次日（+1）。跨太平洋航线常见 */
  arrDayOffset: z.number().int().default(0),
  /** 票价，自由文本如 "$189"。null 渲染「待填」预算槽位 */
  price: z.string().optional(),
  /**
   * 全程时长（分钟，含中转）。跨时区时没法从两端当地时间算出来，
   * 必须由作者提供；null = 未填，线段按等宽画
   */
  durationMin: z.number().int().positive().nullable().default(null),
  /** 客舱/座席类型，如 "经济舱" / "指定席" */
  cabin: z.string().optional(),
  /** 托运行李额说明，如 "2 件 23kg" / "无托运" */
  baggage: z.string().optional(),
  /** 中转行李是否直挂，如 "行李直挂" / "需提取重新托运" */
  throughCheck: z.string().optional(),
  /** 退改签政策，如 "改签 $200 起" / "发车前免费改签" */
  refund: z.string().optional(),
  /** 中转/停靠，按顺序 */
  stops: z.array(TransportStopSchema).default([]),
  /** 值机/检票/提车备注 */
  note: z.string().optional(),
})

export const EventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.enum(CATEGORY_KEYS),
  /** 距当天 00:00 的分钟数 */
  startMin: z.number().int().min(0),
  /** 跨午夜允许 > 1440 */
  endMin: z.number().int().min(0),
  timeKind: z.enum(TIME_KINDS),
  /** 原始 time 字段，原样保留供导出 */
  timeRaw: z.string(),
  placeId: z.string().nullable(),
  flags: z.array(z.enum(FLAG_KEYS)).default([]),
  cost: CostSchema.optional(),
  booking: BookingSchema.optional(),
  /**
   * 长途换乘段（0..n 条，多人汇合时一人一条）。
   * 只在**首次引用**某段长途的事件上非空 —— 解析器按日期序把 trip-transports
   * 的明细灌进第一个 `detail:` 引用它的事件，后续引用是「简单提及」，不重复。
   */
  transports: z.array(TransportSchema).default([]),
  /**
   * `detail:` 引用的前置记录名（trip-transports / trip-stays / trip-rentals 的 what）。
   * 事件专注行程本身，大段事务的细节全部住在前置块里，这里只留一根指针。
   * 序列化写回 `detail: 名字`。
   */
  detailRef: z.string().optional(),
  /**
   * 正文摘要 —— 第一段。卡片默认只显示这一段。
   * TripMD 的通用书写约定：首段写"一句话说清这是什么/怎么做"，细节放后面。
   */
  summary: z.string().default(''),
  /** 首段之外的正文，卡片里折叠 */
  detail: z.string().default(''),
  /**
   * 注意条目 —— 结构化的「有坑」提醒（截止、防盗、必带装备…）。
   * 与散文正文分开存，卡片里渲染成与「如果」同款的条目行。
   */
  notes: z.array(z.string()).default([]),
  variants: z.array(VariantSchema).default([]),
})

export const LegSchema = z.object({
  id: z.string().min(1),
  /**
   * 这一段路发生在哪个事件之后。
   * 不能靠 from/to 的 placeId 反查 —— 同一地点一天内可能出现多次
   * （Day 1 的 Astra 就出现两次），placeId 对不出唯一的位置。
   */
  afterEventId: z.string().min(1),
  /** placeId；起点或终点没有地点时为 null */
  from: z.string().nullable(),
  to: z.string().nullable(),
  mode: z.enum(TRANSPORT_MODES),
  durationMin: z.number().int().positive().nullable(),
  distanceKm: z.number().positive().nullable(),
  label: z.string().optional(),
  note: z.string().optional(),
  /** encoded polyline；null → 地图上画虚线弧 */
  geometry: z.string().nullable(),
})

export const DaySchema = z.object({
  index: z.number().int().positive(),
  date: z.string().regex(iso),
  weekday: z.string(),
  theme: z.string().optional(),
  /** 地图上这一天的路径色 */
  color: z.string(),
  sunrise: z.string().optional(),
  sunset: z.string().optional(),
  /** 当天导语（h2 与第一个 h3 之间的自由 Markdown） */
  intro: z.string().default(''),
  events: z.array(EventSchema),
  legs: z.array(LegSchema),
})

export const ConstraintSchema = z.object({
  kind: z.enum(CONSTRAINT_KINDS),
  /** "YYYY-MM-DD HH:MM" */
  at: z.string(),
  date: z.string().regex(iso),
  minute: z.number().int().min(0),
  label: z.string().min(1),
  note: z.string().optional(),
})

/** "YYYY-MM-DD HH:MM" 拆解后的时刻，raw 原样保留供导出 */
export const MomentSchema = z.object({
  raw: z.string(),
  date: z.string().regex(iso),
  minute: z.number().int().min(0),
})

/**
 * 预订的共同骨架。
 *
 * 住宿和长租是同一种东西 —— **有起止时刻的资产占用**：一段时间里
 * 「这间房 / 这辆车归我」，不属于某一天的时间轴，而是横跨若干天的区间。
 * 于是它们共享这个基底，各自只 extend 自己特有的字段。
 *
 * 这个同构一路贯到底：日历的区间带用同一个函数把两者化成坐标，
 * 卡片里的信息模块用同一套零件（ticket-parts）画。
 */
const ReservationBase = z.object({
  /** 订的是什么：酒店名 / "保时捷 Macan" */
  what: z.string().min(1),
  /** 订在哪：万豪 / Airbnb / Booking / Turo / 车主直租… */
  platform: z.string().optional(),
  from: MomentSchema,
  to: MomentSchema,
  /**
   * 这笔预订的钱 —— 写在记录自己身上，预算页与信息模块从同一处取数。
   * 提车/入住**事件**上不再写房费车费（事件 cost 留给当场发生的散项，如停车）。
   */
  cost: CostSchema.optional(),
  /** 退改政策，如 "免费取消至入住前 48 小时" */
  refund: z.string().optional(),
  note: z.string().optional(),
})

/**
 * 住宿 —— 一段「这间房归我」的区间。
 *
 * **不是**从每天的 `lodging:` 靠名字相等合并出来的（那样大小写一漂
 * 区间就断成两截），作者直接写区间，起止两端都在这一条记录上。
 */
export const StaySchema = ReservationBase.extend({
  /** 住在哪（placeId），按名引用地点表；缺省用 what 去找 */
  placeId: z.string().nullable(),
  /** 星级 */
  stars: z.number().int().positive().optional(),
  /** 房型，如 "大床房" / "双床房" */
  room: z.string().optional(),
  /** 停车：含 / 不含 / "$30 每晚" 这类自由文本 */
  parking: z.string().optional(),
  /** 早餐：含 / 不含 */
  breakfast: z.string().optional(),
})

/**
 * 长租 —— 有明确取还时刻的租赁资产：租车、随身 WiFi、滑雪装备。
 *
 * 取/还动作可以另写成 logistics 事件，但区间本身不属于任何一天。
 * 租金写在记录自己的 cost 上（继承自 ReservationBase），随预订走。
 */
export const RentalSchema = ReservationBase.extend({
  /** 里程**上限**（不是预估行驶里程），自由文本，如 "600 英里" / "不限" / "每日 200 英里" */
  mileage: z.string().optional(),
  /** 保险方案，如 "全险 + 三者 100 万" */
  insurance: z.string().optional(),
  /** 取/还地点（placeId），按名引用地点表 */
  pickupPlaceId: z.string().nullable(),
  dropoffPlaceId: z.string().nullable(),
})

/**
 * 作者只写日期不写时刻时的保底 —— 入住 18:00、退房 10:00，行业惯例。
 *
 * 保底在**解析时**就填进 `minute`，导出仍按作者写的 `raw` 原样写回，
 * 所以往返幂等不受影响，而下游拿到的区间**两端永远有确定值**，
 * 不存在「这条带该画到哪」的悬空情形。
 */
export const DEFAULT_CHECK_IN = 18 * 60
export const DEFAULT_CHECK_OUT = 10 * 60

/**
 * 长途 —— 一段带票面明细的跨城移动：去程航班、新干线、跨城巴士、轮渡。
 *
 * 和住宿/租车一样是**前置声明**：细节（承运方、时刻、票价、行李、退改）
 * 全部写在顶层块里，每日行程中的事件用 `transport: 名字` 一句话引用。
 * 解析时明细灌进事件的 transports，票面时间轴/日历/导出零改动。
 *
 * 多人从不同地方出发汇合 = 一段长途里的多条 transport，各带 traveler。
 */
export const JourneySchema = z.object({
  /** 这段长途叫什么，事件按它引用 —— 全文唯一 */
  what: z.string().min(1),
  /** 总预算（多人多段加总的那个数），进预算统计 */
  cost: CostSchema.optional(),
  transports: z.array(TransportSchema).default([]),
})

export const ReferenceSchema = z.object({
  id: z.string().min(1),
  icon: z.string().optional(),
  title: z.string().min(1),
  markdown: z.string(),
})

export const TripSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  destination: z.string().min(1),
  timezone: z.string().min(1),
  dates: z.object({ start: z.string().regex(iso), end: z.string().regex(iso) }),
  travelers: z.number().int().positive().optional(),
  currency: z.string().optional(),
  constraints: z.array(ConstraintSchema).default([]),
  /** 长途（前置声明，事件按名引用） */
  journeys: z.array(JourneySchema).default([]),
  /** 住宿区间，与 rentals 同构 */
  stays: z.array(StaySchema).default([]),
  rentals: z.array(RentalSchema).default([]),
  places: z.array(PlaceSchema).default([]),
  days: z.array(DaySchema),
  reference: z.array(ReferenceSchema).default([]),
})

export const TripSummarySchema = TripSchema.pick({
  id: true,
  title: true,
  subtitle: true,
  destination: true,
  dates: true,
}).extend({
  travelers: z.number().int().positive().optional(),
  dayCount: z.number().int().positive(),
  eventCount: z.number().int().nonnegative(),
  /** 还有几项没订 —— 卡片上唯一一个「需要你行动」的数字 */
  bookingCount: z.number().int().nonnegative(),
  /**
   * 每天的构成，个人空间卡片上那排竖条的数据源。
   *
   * 存分钟数而非色值 —— 配色以后要调（甚至用户可自定义），
   * 数据不该跟着重新导入一遍。
   */
  dayShape: z.array(
    z.object({
      /** 玩 / 吃 / 其他 各占多少分钟 */
      play: z.number().nonnegative(),
      food: z.number().nonnegative(),
      other: z.number().nonnegative(),
      /** 当天从第一个事件到最后一个事件的跨度，决定竖条高度 */
      span: z.number().nonnegative(),
    }),
  ),
})

export type Coord = z.infer<typeof CoordSchema>
export type Place = z.infer<typeof PlaceSchema>
export type Variant = z.infer<typeof VariantSchema>
export type Booking = z.infer<typeof BookingSchema>
export type Cost = z.infer<typeof CostSchema>
export type Transport = z.infer<typeof TransportSchema>
export type TransportStop = z.infer<typeof TransportStopSchema>
export type TripEvent = z.infer<typeof EventSchema>
export type Leg = z.infer<typeof LegSchema>
export type Day = z.infer<typeof DaySchema>
export type Constraint = z.infer<typeof ConstraintSchema>
export type Moment = z.infer<typeof MomentSchema>
export type Stay = z.infer<typeof StaySchema>
export type Rental = z.infer<typeof RentalSchema>
/** 住宿与长租的公共形状 —— 只关心「起止时刻的资产占用」的代码收这个类型 */
export type Reservation = Stay | Rental
export type Journey = z.infer<typeof JourneySchema>
export type Reference = z.infer<typeof ReferenceSchema>
export type Trip = z.infer<typeof TripSchema>
export type TripSummary = z.infer<typeof TripSummarySchema>
