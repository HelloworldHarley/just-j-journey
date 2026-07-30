import { TRANSPORTS, type Place, type TransportMode } from '@jjj/schema'

/**
 * 地图深链。
 *
 * 关键点：**没有坐标也能工作。** 用地名查询对有名号的商家往往比坐标更准
 * （Google 会解析到真正的 POI，而坐标只会落在一个点上）。
 * 所以坐标是锦上添花，不是前置条件。
 *
 * Apple 的 `daddr=<纯经纬度>` 在新版 iOS 上有回归报告，
 * 一律用「地名 + ll 坐标」组合，两者互为保险。
 * https://developer.apple.com/forums/thread/784030
 */

export type MapProvider = 'google' | 'apple'

/** iOS / iPadOS / macOS 默认 Apple 地图，其余默认 Google。两者始终都给，不锁死。 */
export function preferredProvider(): MapProvider {
  if (typeof navigator === 'undefined') return 'google'
  const ua = navigator.userAgent
  const isApple =
    /iPhone|iPad|iPod|Macintosh/.test(ua) ||
    // iPadOS 13+ 的 UA 伪装成 Mac，靠触点数区分
    (navigator.maxTouchPoints > 1 && /Mac/.test(ua))
  return isApple ? 'apple' : 'google'
}

export const PROVIDER_LABEL: Record<MapProvider, string> = {
  google: 'Google 地图',
  apple: 'Apple 地图',
}

function queryOf(place: Place): string {
  // 英文名给地图服务命中率更高；中文名是给人看的
  return place.nameEn ?? place.name
}

/**
 * 打开一个地点。
 *
 * **永远带地名，坐标只用来定位，不用来代替地名。**
 * 人打开地图想看到的是「Space Needle」，不是「47.6205, -122.3493」——
 * 后者既读不出是哪，也拿不到营业时间、评价、照片这些真正有用的东西。
 */
export function placeUrl(place: Place, provider: MapProvider): string {
  const q = queryOf(place)

  if (provider === 'apple') {
    // Apple 支持 q（地名）+ ll（坐标）并存：显示地名，定位到坐标
    const p = new URLSearchParams({ q })
    if (place.coord) p.set('ll', `${place.coord[1]},${place.coord[0]}`)
    return `https://maps.apple.com/?${p.toString()}`
  }

  // 有 place_id 最理想：官方 API 形式，既精确又显示商家面板
  if (place.gmapsPlaceId) {
    const p = new URLSearchParams({ api: '1', query: q, query_place_id: place.gmapsPlaceId })
    return `https://www.google.com/maps/search/?${p.toString()}`
  }

  // 没有 place_id 时，官方的 ?api=1&query= 只能二选一（地名 或 坐标）。
  // 改用 Google 自己地址栏那套路径形式：/search/<地名>/@<坐标>,<缩放>
  // —— 按地名搜索、同时把地图中心钉在坐标上，两者都保住。
  if (place.coord) {
    return (
      `https://www.google.com/maps/search/${encodeURIComponent(q)}` +
      `/@${place.coord[1]},${place.coord[0]},16z`
    )
  }

  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: q })}`
}

export function directionsUrl(
  from: Place | null,
  to: Place,
  mode: TransportMode,
  provider: MapProvider,
): string {
  const t = TRANSPORTS[mode]
  if (provider === 'apple') {
    const p = new URLSearchParams({ daddr: queryOf(to), dirflg: t.apple })
    if (to.coord) p.set('ll', `${to.coord[1]},${to.coord[0]}`)
    if (from) p.set('saddr', queryOf(from))
    return `https://maps.apple.com/?${p.toString()}`
  }
  const p = new URLSearchParams({
    api: '1',
    destination: queryOf(to),
    travelmode: t.gmaps,
  })
  if (from) p.set('origin', queryOf(from))
  return `https://www.google.com/maps/dir/?${p.toString()}`
}
