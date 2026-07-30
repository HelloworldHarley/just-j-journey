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

/** 中转站。时长未填时 UI 画等宽段并留「待填」空位。 */
export const FlightStopSchema = z.object({
  /** 中转机场，如 "ICN" */
  airport: z.string().optional(),
  /** 停留分钟数；null = 未填 */
  waitMin: z.number().int().positive().nullable().default(null),
})

/**
 * 航班详情。挂在 category: flight 的事件上。
 *
 * **所有字段可空** —— 行程常常先排好、机票后买。UI 对 flight 事件
 * 永远渲染完整的时间轴骨架，缺的字段显示「待填」空位，
 * 之后人工补进 TripMD 或由 Agent 填入。
 */
export const FlightSchema = z.object({
  /** 航司，如 "全日空 ANA" */
  airline: z.string().optional(),
  /** 航班号，如 "NH178"；多段可写 "DL281 · DL167" */
  flightNo: z.string().optional(),
  /** 出发机场/航站楼，如 "PVG T2" */
  from: z.string().optional(),
  /** 到达机场/航站楼 */
  to: z.string().optional(),
  /** 起飞当地时间 "10:15" */
  depTime: z.string().optional(),
  /** 降落当地时间 "13:11" */
  arrTime: z.string().optional(),
  /** 降落在第几天后：0 当天，1 次日（+1）。跨太平洋航线常见 */
  arrDayOffset: z.number().int().default(0),
  /**
   * 全程时长（分钟，含中转）。跨时区时没法从两端当地时间算出来，
   * 必须由作者提供；null = 未填，线段按等宽画
   */
  durationMin: z.number().int().positive().nullable().default(null),
  /** 托运行李额说明，如 "2 件 23kg" / "无托运" */
  baggage: z.string().optional(),
  /** 中转，按顺序 */
  stops: z.array(FlightStopSchema).default([]),
  /** 值机/登机口备注 */
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
  flight: FlightSchema.optional(),
  /**
   * 正文摘要 —— 第一段。卡片默认只显示这一段。
   * TripMD 的通用书写约定：首段写"一句话说清这是什么/怎么做"，细节放后面。
   */
  summary: z.string().default(''),
  /** 首段之外的正文，卡片里折叠 */
  detail: z.string().default(''),
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
  lodging: z
    .object({ placeId: z.string().nullable(), name: z.string(), note: z.string().optional() })
    .optional(),
  /** 「赶不上时的砍站顺序」 */
  fallbackOrder: z.array(z.string()).default([]),
  weatherNote: z.string().optional(),
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
export type Flight = z.infer<typeof FlightSchema>
export type FlightStop = z.infer<typeof FlightStopSchema>
export type TripEvent = z.infer<typeof EventSchema>
export type Leg = z.infer<typeof LegSchema>
export type Day = z.infer<typeof DaySchema>
export type Constraint = z.infer<typeof ConstraintSchema>
export type Reference = z.infer<typeof ReferenceSchema>
export type Trip = z.infer<typeof TripSchema>
export type TripSummary = z.infer<typeof TripSummarySchema>
