import {
  CONSTRAINT_KINDS,
  DEFAULT_CHECK_IN,
  DEFAULT_CHECK_OUT,
  TRANSPORT_ALIASES,
  TRANSPORT_MODES,
  resolveTransport,
  type CategoryKey,
  type Constraint,
  type ConstraintKind,
  type Place,
  type Trip,
  type TripEvent,
} from '@jjj/schema'
import { DiagnosticBag, suggest, suggestEnum } from './diagnostics.ts'
import {
  CONSTRAINT_KEYS,
  JOURNEY_KEYS,
  PLACE_KEYS,
  RENTAL_KEYS,
  STAY_KEYS,
  STOP_KEYS,
  TRANSPORT_KEYS,
  asRecord,
  checkKeys,
  num,
  readCategory,
  str,
  type Rec,
} from './read.ts'
import { parseCost } from './cost.ts'
import type { Fence } from './sections.ts'
import {
  parseDateTime,
  parseDurationMin,
  parseLatLng,
  placeId as makePlaceId,
  placeKey,
} from './values.ts'

/**
 * 前置块的语义解析 —— 地点表 / 硬约束 / 长途 / 住宿 / 长租。
 *
 * 输入是 sections 扫出来的围栏值，输出是 Trip 的对应数组。
 * 除了 places 这张会被事件引用继续长大的表，这里没有跨块状态。
 */

/** 解析期共享的少量上下文 —— 金额换算要用的人数与默认币种 */
export interface ParseCtx {
  bag: DiagnosticBag
  travelers: number
  currency: string | undefined
}

export function readPlaces(
  bag: DiagnosticBag,
  placeFences: Fence[],
): { places: Map<string, Place>; placeLines: Map<string, number> } {
  const places = new Map<string, Place>()
  const placeLines = new Map<string, number>()

  for (const fence of placeFences) {
    const list = fence.value
    if (list === null) continue
    if (!Array.isArray(list)) {
      bag.error(fence.line, '`trip-places` 必须是一个列表', '每个地点以 `- name: ...` 开头')
      continue
    }
    for (const item of list) {
      const rec = asRecord(item)
      if (!rec) {
        bag.error(fence.line, '`trip-places` 里有一项不是对象')
        continue
      }
      const name = str(rec['name'])
      if (!name) {
        bag.error(fence.line, '`trip-places` 里有一项缺少 `name`')
        continue
      }
      checkKeys(bag, rec, PLACE_KEYS, fence.line, 'trip-places')
      const key = placeKey(name)
      if (places.has(key)) {
        bag.warn(fence.line, `地点 "${name}" 重复声明，后一条已忽略`)
        continue
      }
      const nameEn = str(rec['en']) ?? str(rec['nameEn'])
      let coord: [number, number] | null = null
      if (rec['coord'] !== undefined && rec['coord'] !== null) {
        const ll = parseLatLng(rec['coord'])
        if (ll) coord = [ll[1], ll[0]] // → [lng, lat]
        else
          bag.error(
            fence.line,
            `地点 "${name}" 的 coord 无法解析：${JSON.stringify(rec['coord'])}`,
            '写成 `coord: 47.6205, -122.3400`（纬度在前，经度在后）',
          )
      }
      places.set(key, {
        id: makePlaceId(name, nameEn),
        name,
        nameEn,
        coord,
        category: readCategory(bag, fence.line, rec['category'], `地点 "${name}"`, 'sight') ?? 'sight',
        tentative: rec['tentative'] === true,
        gmapsPlaceId: str(rec['gmaps_place_id']) ?? str(rec['gmapsPlaceId']),
        url: str(rec['url']),
        note: str(rec['note']),
        geo: {
          source: coord ? 'authored' : 'none',
          confidence: coord ? 'high' : 'unknown',
          query: nameEn ?? name,
        },
      })
      placeLines.set(key, fence.line)
    }
  }
  return { places, placeLines }
}

export type PlaceResolver = (name: string, line: number, category: CategoryKey) => string

/** 事件引用了未声明的地点 → 自动建档并提醒，而不是报错中断。 */
export function makePlaceResolver(bag: DiagnosticBag, places: Map<string, Place>): PlaceResolver {
  return (name, line, category) => {
    const key = placeKey(name)
    const hit = places.get(key)
    if (hit) return hit.id
    const near = suggest(name, [...places.values()].map((p) => p.name))
    bag.warn(
      line,
      `地点 "${name}" 未在 \`trip-places\` 中声明`,
      near ? `是否指 "${near}"？名称需完全一致` : '将按名称生成地图链接；补进地点表可获得坐标',
    )
    const created: Place = {
      id: makePlaceId(name),
      name,
      coord: null,
      category,
      tentative: false,
      geo: { source: 'none', confidence: 'unknown', query: name },
    }
    places.set(key, created)
    return created.id
  }
}

export function readConstraints(bag: DiagnosticBag, constraintFences: Fence[]): Constraint[] {
  const constraints: Constraint[] = []
  for (const fence of constraintFences) {
    const list = fence.value
    if (list === null) continue
    if (!Array.isArray(list)) {
      bag.error(fence.line, '`trip-constraints` 必须是一个列表', '每条以 `- kind: ...` 开头')
      continue
    }
    for (const item of list) {
      const rec = asRecord(item)
      if (!rec) continue
      checkKeys(bag, rec, CONSTRAINT_KEYS, fence.line, 'trip-constraints')
      let kindRaw = str(rec['kind']) ?? ''
      // 中文容错
      if (kindRaw === '抵达') kindRaw = 'arrive'
      if (kindRaw === '离开') kindRaw = 'depart'
      const kind = (CONSTRAINT_KINDS as readonly string[]).includes(kindRaw)
        ? (kindRaw as ConstraintKind)
        : null
      if (!kind) {
        const guess = suggest(kindRaw, CONSTRAINT_KINDS)
        bag.error(
          fence.line,
          `约束 kind "${kindRaw}" 无效`,
          guess ? `是否想写 \`${guess}\`？` : `可选值：${CONSTRAINT_KINDS.join(' / ')}`,
        )
        continue
      }
      const label = str(rec['label'])
      if (!label) {
        bag.error(fence.line, `\`${kind}\` 约束缺少 \`label\``)
        continue
      }
      const atRaw = str(rec['at']) ?? ''
      const dt = parseDateTime(atRaw)
      if (!dt) {
        bag.error(fence.line, `约束 "${label}" 的 \`at\` "${atRaw}" 无法解析`, '格式为 `2026-10-05 11:20`')
        continue
      }
      constraints.push({ kind, at: atRaw, date: dt.date, minute: dt.minute, label, note: str(rec['note']) })
    }
  }
  return constraints
}

// 长途换乘段的字段读取 —— 顶层 trip-transports 共用这一份。
// 所有字段都可空：票常常晚于行程定下来，UI 会为缺的字段留「待填」空位。
function readTransport(bag: DiagnosticBag, line: number, frec: Rec): TripEvent['transports'][number] | null {
  checkKeys(bag, frec, TRANSPORT_KEYS, line, 'transport')
  const modeRaw = str(frec['mode'])
  let mode = modeRaw ? resolveTransport(modeRaw) : null
  if (modeRaw && !mode) {
    const guess = suggestEnum(modeRaw, TRANSPORT_MODES, TRANSPORT_ALIASES)
    bag.warn(
      line,
      `transport 的 mode "${modeRaw}" 无法识别，按 flight 处理`,
      guess ? `是否想写 \`${guess}\`？` : undefined,
    )
    mode = 'flight'
  }
  // 单个中转写成 map 而非列表也接受 —— 与紧邻的 transport 字段同样的宽容度，
  // 否则 `stops: {airport: SEA}` 会静默丢掉整个中转段
  const stopsField = frec['stops']
  const stopsRaw = Array.isArray(stopsField) ? stopsField : stopsField ? [stopsField] : []
  for (const sr of stopsRaw) {
    const rec = asRecord(sr)
    if (rec) checkKeys(bag, rec, STOP_KEYS, line, 'stops')
  }
  return {
    traveler: str(frec['traveler']) ?? str(frec['who']),
    mode: mode ?? 'flight',
    carrier: str(frec['carrier']) ?? str(frec['airline']),
    number: str(frec['number']) ?? str(frec['flight_no']) ?? str(frec['flightNo']) ?? str(frec['no']),
    from: str(frec['from']),
    to: str(frec['to']),
    depDate: str(frec['dep_date']) ?? str(frec['depDate']),
    depTime: str(frec['dep_time']) ?? str(frec['depTime']) ?? str(frec['dep']),
    arrTime: str(frec['arr_time']) ?? str(frec['arrTime']) ?? str(frec['arr']),
    arrDate: str(frec['arr_date']) ?? str(frec['arrDate']),
    arrDayOffset: num(frec['arr_day_offset']) ?? num(frec['arrDayOffset']) ?? 0,
    price: str(frec['price']) ?? str(frec['fare']),
    durationMin: parseDurationMin(frec['duration']),
    cabin: str(frec['cabin']) ?? str(frec['class']) ?? str(frec['seat']),
    baggage: str(frec['baggage']),
    throughCheck:
      str(frec['through_check']) ?? str(frec['throughCheck']) ?? str(frec['baggage_through']),
    refund: str(frec['refund']) ?? str(frec['change_policy']) ?? str(frec['change']),
    stops: stopsRaw
      .map((sr) => asRecord(sr))
      .filter((sr): sr is Rec => sr !== null)
      .map((sr) => ({
        airport: str(sr['airport']) ?? str(sr['station']) ?? str(sr['place']),
        depAirport:
          str(sr['dep_airport']) ?? str(sr['dep_station']) ?? str(sr['dep_place']),
        arrTime: str(sr['arr_time']) ?? str(sr['arr']),
        depTime: str(sr['dep_time']) ?? str(sr['dep']),
        arrDate: str(sr['arr_date']),
        depDate: str(sr['dep_date']),
        legMin: parseDurationMin(sr['leg']),
        waitMin: parseDurationMin(sr['wait']),
      })),
    note: str(frec['note']),
  }
}

/** `transport:` 接受单个 map 或列表；owner 用于报错时说明是谁的 */
function readTransportList(
  bag: DiagnosticBag,
  line: number,
  raw: unknown,
  owner: string,
): TripEvent['transports'] {
  const out: TripEvent['transports'] = []
  for (const item of Array.isArray(raw) ? raw : raw ? [raw] : []) {
    const rec = asRecord(item)
    if (!rec) {
      bag.warn(line, `${owner}的 transport 列表里有一项不是对象，已忽略`)
      continue
    }
    const t = readTransport(bag, line, rec)
    if (t) out.push(t)
  }
  return out
}

// ── 预订（住宿 / 长租）──
//
// 两者是同一种东西：有起止时刻的资产占用。骨架（what/platform/from/to/退改/备注）
// 走同一个解析器，各自只读自己特有的字段 —— 校验口径也因此只有一份。
interface ReservationBase {
  what: string
  platform?: string
  from: Trip['rentals'][number]['from']
  to: Trip['rentals'][number]['to']
  cost?: Trip['rentals'][number]['cost']
  refund?: string
  note?: string
}

export interface FrontBlocks {
  journeys: Trip['journeys']
  stays: Trip['stays']
  rentals: Trip['rentals']
  /** detail: 引用的名字空间（what → 声明它的块名），三个前置块共享 */
  detailNames: Map<string, string>
}

export function readFrontBlocks(
  ctx: ParseCtx,
  fences: { journeyFences: Fence[]; stayFences: Fence[]; rentalFences: Fence[] },
  resolvePlaceRef: PlaceResolver,
): FrontBlocks {
  const { bag } = ctx
  const cost = (raw: string | undefined) =>
    raw ? parseCost(raw, ctx.travelers, ctx.currency) : undefined

  const reservationOf = (
    rec: Rec,
    line: number,
    block: string,
    /** 只写日期时两端各自的保底时刻 */
    defFrom: number,
    defTo: number,
  ): ReservationBase | null => {
    const what = str(rec['what']) ?? str(rec['item']) ?? str(rec['name'])
    if (!what) {
      bag.error(line, `\`${block}\` 里有一项缺少 \`what\``, '写成 `- what: Astra Hotel`')
      return null
    }
    const fromRaw = str(rec['from']) ?? ''
    const toRaw = str(rec['to']) ?? ''
    const from = parseDateTime(fromRaw, defFrom)
    const to = parseDateTime(toRaw, defTo)
    if (!from || !to) {
      bag.error(
        line,
        `「${what}」的 ${!from ? 'from' : 'to'} "${!from ? fromRaw : toRaw}" 无法解析`,
        '格式为 `2026-10-02 11:30`，只写 `2026-10-02` 则按保底时刻算',
      )
      return null
    }
    if (to.date < from.date || (to.date === from.date && to.minute <= from.minute)) {
      bag.error(line, `「${what}」的结束时刻不晚于开始时刻`)
      return null
    }
    return {
      what,
      platform: str(rec['platform']) ?? str(rec['brand']) ?? str(rec['company']),
      from: { raw: fromRaw, ...from },
      to: { raw: toRaw, ...to },
      cost: cost(str(rec['cost'])),
      refund: str(rec['refund']) ?? str(rec['cancellation']),
      note: str(rec['note']),
    }
  }

  /** 每个块都是「- 开头的一串记录」，列表形状校验也只写一遍 */
  const eachItem = (
    fences_: Fence[],
    block: string,
    fn: (rec: Rec, line: number) => void,
  ): void => {
    for (const fence of fences_) {
      if (fence.value === null) continue
      if (!Array.isArray(fence.value)) {
        bag.error(fence.line, `\`${block}\` 必须是一个列表`, '每项以 `- what: ...` 开头')
        continue
      }
      for (const item of fence.value) {
        const rec = asRecord(item)
        if (rec) {
          fn(rec, fence.line)
        } else {
          // `- Astra Hotel`（漏写 what:）这种项静默丢掉 = 整条住宿消失，必须吭声
          bag.error(fence.line, `\`${block}\` 里有一项不是键值对`, '每项以 `- what: ...` 开头')
        }
      }
    }
  }

  // 事件 detail: 引用的名字空间 —— 三个前置块共享。
  // 撞名会让引用分不清指谁，所以注册时就报，带着行号。
  const detailNames = new Map<string, string>()
  const registerDetailName = (what: string, block: string, line: number): boolean => {
    const existing = detailNames.get(what)
    if (existing) {
      bag.error(
        line,
        `「${what}」在 ${existing} 里已经声明过`,
        '事件的 `detail:` 按名字引用，长途/住宿/长租之间名字必须唯一',
      )
      return false
    }
    detailNames.set(what, block)
    return true
  }

  const journeys: Trip['journeys'] = []
  eachItem(fences.journeyFences, 'trip-transports', (rec, line) => {
    const what = str(rec['what']) ?? str(rec['name'])
    if (!what) {
      bag.error(line, '`trip-transports` 里有一项缺少 `what`（这段长途叫什么）')
      return
    }
    if (!registerDetailName(what, 'trip-transports', line)) return
    checkKeys(bag, rec, JOURNEY_KEYS, line, 'trip-transports')
    journeys.push({
      what,
      cost: cost(str(rec['cost'])),
      transports: readTransportList(bag, line, rec['transport'] ?? rec['transports'], `长途「${what}」`),
    })
  })

  const stays: Trip['stays'] = []
  eachItem(fences.stayFences, 'trip-stays', (rec, line) => {
    const base = reservationOf(rec, line, 'trip-stays', DEFAULT_CHECK_IN, DEFAULT_CHECK_OUT)
    if (!base) return
    if (!registerDetailName(base.what, 'trip-stays', line)) return
    checkKeys(bag, rec, STAY_KEYS, line, 'trip-stays')
    // stars 写歪不该让整趟行程解析失败（zod 只会抛裸英文），也不该静默消失
    const starsRaw = rec['stars'] ?? rec['star']
    let stars = num(starsRaw)
    if (starsRaw !== undefined && (stars === undefined || !Number.isInteger(stars) || stars <= 0)) {
      bag.warn(line, `「${base.what}」的 stars "${String(starsRaw)}" 不是正整数，已忽略`, '写成 stars: 4')
      stars = undefined
    }
    stays.push({
      ...base,
      // 酒店名通常就是地点名，省掉 `place:` 这行重复
      placeId: resolvePlaceRef(str(rec['place']) ?? base.what, line, 'hotel'),
      stars,
      room: str(rec['room']),
      parking: str(rec['parking']),
      breakfast: str(rec['breakfast']),
    })
  })

  const rentals: Trip['rentals'] = []
  eachItem(fences.rentalFences, 'trip-rentals', (rec, line) => {
    const base = reservationOf(rec, line, 'trip-rentals', 0, 0)
    if (!base) return
    if (!registerDetailName(base.what, 'trip-rentals', line)) return
    checkKeys(bag, rec, RENTAL_KEYS, line, 'trip-rentals')
    const pickup = str(rec['pickup'])
    const dropoff = str(rec['dropoff'])
    rentals.push({
      ...base,
      mileage: str(rec['mileage']) ?? str(rec['miles']),
      insurance: str(rec['insurance']),
      pickupPlaceId: pickup ? resolvePlaceRef(pickup, line, 'logistics') : null,
      dropoffPlaceId: dropoff ? resolvePlaceRef(dropoff, line, 'logistics') : null,
    })
  })

  // 两个块都按开始时刻排 —— 日历的区间带、列表的「住/行」视图都按时间顺序读
  const byStart = (a: ReservationBase, b: ReservationBase): number =>
    a.from.date.localeCompare(b.from.date) || a.from.minute - b.from.minute
  stays.sort(byStart)
  rentals.sort(byStart)

  return { journeys, stays, rentals, detailNames }
}
