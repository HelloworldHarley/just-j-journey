import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, Route, Waypoints } from 'lucide-react'
import {
  Map as LibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type GeoJSONSourceSpecification,
  type StyleSpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { Trip } from '@jjj/schema'
import { missingCoords } from '@jjj/tripmd'
import {
  cardFocusOffset,
  dashCasing,
  dayPaths,
  pinOffsets,
  sceneBounds,
  startFlagOffset,
  stopKey,
  stopNeighbors,
  straightSegments,
  type DayPath,
  type DayStop,
} from '../../lib/map-scene.ts'
import { Segmented, segChip } from '../../components/Segmented.tsx'
import { Problem } from '../../components/States.tsx'
import { readViewState, writeViewState } from '../../lib/settings.ts'
import { PlaceCard } from './PlaceCard.tsx'

/**
 * 地图视图 —— 行程的空间形状：每天一色的动线铺在真底图上。
 *
 * 分工与日历相同：投影数学在 lib/map-scene.ts（纯函数 + 单测），
 * 这里只管把场景塞进 maplibre 的 source/layer/marker 并响应交互。
 *
 * 硬约束：运行时零 API 调用 —— 瓦片是静态取用，路线是虚线直连
 * （真路网 polyline 由下一轮 enrich 管道预计算进 legs.geometry）。
 */

/*
  瓦片解析跑在 web worker 里，而 maplibre 自己**在运行时**拼那个文件的地址：
  拿 `import.meta.url` 换名成同目录的 `maplibre-gl-worker.mjs`。这个字符串是算出来的，
  打包器静态分析看不见，于是 worker 文件从来没被拷进产物 —— 线上请求
  `/assets/maplibre-gl-worker.mjs` 直接 404，底图和动线全画不出来（pin 是 DOM，照常显示）。

  用 `?url` 显式导入，文件就成了 vite 认得的一份资源（带 hash、跟着 base 走），
  再用官方的 `setWorkerUrl` 告诉 maplibre 去哪儿取。放在模块顶层：这一句必须早于
  任何 `new LibreMap`，而地图整块是懒加载的，chunk 求值时正好赶在组件渲染之前。

  **这个坑 dev 和 `vite preview` 都照不出来**：dev 下 maplibre 从 node_modules 直接加载、
  worker 就在它旁边；preview 有 SPA 回退，会把缺失的文件回成 200 + index.html。
  只有真静态托管（GitHub Pages）才 404。验证要对着产物 + 真静态服务器跑。
*/
setWorkerUrl(workerUrl)

/** 底图样式。3d = liberty + 建筑挤出 + 俯仰角，不是独立样式表 */
const STYLE_KEYS = ['bright', 'positron', 'liberty', '3d'] as const
type StyleKey = (typeof STYLE_KEYS)[number]
const STYLE_URL: Record<StyleKey, string> = {
  bright: 'https://tiles.openfreemap.org/styles/bright',
  positron: 'https://tiles.openfreemap.org/styles/positron',
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
  '3d': 'https://tiles.openfreemap.org/styles/liberty',
}
const STYLE_KEY = 'jjj:mapstyle'
const readStyle = (): StyleKey => {
  const v = readViewState(STYLE_KEY)
  return (STYLE_KEYS as readonly string[]).includes(v ?? '') ? (v as StyleKey) : 'bright'
}

/**
 * 动线画法：真实路网 / 站点直连。默认真路 —— 数据是真的，就该先给真的。
 * 直连那一档看的是骨架与顺序，真路绕来绕去时反而看不清站与站的关系。
 */
const ROUTES_KEY = 'jjj:maproutes'
const readRoutes = (): boolean => readViewState(ROUTES_KEY) !== 'straight'

/** 断网/瓦片故障时的兜底底图：一张纸色画布 —— 动线和 pin 不依赖瓦片，照常画 */
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#f1e9d2' } }],
}

/**
 * 非选中天的淡化程度。压得比「看得见」更狠一档是故意的 ——
 * 选中某天后镜头会收到当天范围，别的日子多半已经飞出视野，
 * 只有边缘那几个还在画面里；它们必须一眼就是背景，否则等于没淡化。
 * 光靠透明度不够（彩底上 0.2 的彩色 pin 依然跳），再叠一层去色。
 */
const DIM_LINE = 0.07
const DIM_PIN = 0.15
const DIM_FILTER = 'grayscale(0.85)'

/** 兜底直连线的宽度与 dash（dash 的单位是线宽，不是像素） */
const EST_WIDTH = 2.5
const EST_DASH = 2

/**
 * 起点旗：赛车起跑的黑白格子旗。
 *
 * **有意不用 pin 那套形状与配色** —— 它要说的不是「这里有个地点」而是「从这儿发车」，
 * 长得像标签就又混进一排彩色圆点里了。黑白格在任何底图上都认得出，
 * 也不跟五天的动线色抢。
 *
 * 旗杆画到 viewBox 底边：它是**插进** pin 里的（抬升量见 `startFlagOffset`），
 * 到不了底就会露出一条缝。旗杆与旗面各带一圈米色描边（`paint-order="stroke"`
 * 让描边落在填充之后），彩底与深底上都不会糊掉。
 */
const FLAG_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  '<g stroke="#fffdf6" stroke-width="1.8" paint-order="stroke">' +
  '<path d="M10.4 1.4 h1.9 V24 h-1.9 Z" fill="#1d1a14" />' +
  '<path d="M12.3 1.9 h11 v7.2 h-11 Z" fill="#fdfcf7" />' +
  '</g>' +
  '<g fill="#1d1a14">' +
  '<path d="M12.3 1.9 h3.67 v3.6 h-3.67 Z" />' +
  '<path d="M19.63 1.9 h3.67 v3.6 h-3.67 Z" />' +
  '<path d="M15.97 5.5 h3.66 v3.6 h-3.66 Z" />' +
  '</g>' +
  '<path d="M12.3 1.9 h11 v7.2 h-11 Z" fill="none" stroke="#1d1a14" stroke-width="0.7" />' +
  '</svg>'

export default function MapView({ trip }: { trip: Trip }) {
  const navigate = useNavigate()
  const paths = useMemo(() => dayPaths(trip), [trip])
  const missing = useMemo(() => missingCoords(trip), [trip])
  const places = useMemo(() => new Map(trip.places.map((p) => [p.id, p])), [trip])
  const events = useMemo(
    () => new Map(trip.days.flatMap((d) => d.events).map((e) => [e.id, e])),
    [trip],
  )

  const [day, setDay] = useState<number | null>(null)
  const [realRoutes, setRealRoutes] = useState(readRoutes)
  const [styleKey, setStyleKey] = useState<StyleKey>(readStyle)
  const [selected, setSelected] = useState<{ stop: DayStop; dayIndex: number } | null>(null)
  const [degraded, setDegraded] = useState(false)
  const [missingOpen, setMissingOpen] = useState(false)
  const [styleOpen, setStyleOpen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LibreMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  /** 样式是否成功载入过 —— 首个 error 早于它就切兜底纸底 */
  const styleOkRef = useRef(false)
  const dayRef = useRef(day)
  dayRef.current = day
  const styleKeyRef = useRef(styleKey)
  styleKeyRef.current = styleKey

  /**
   * 真正画上去的那份动线。站点两档完全一样，只有段落换了 ——
   * 所以 pin、邻站、空态判断照旧读 `paths`，只有 source 的数据读这里。
   */
  const scene = useMemo(
    () =>
      realRoutes
        ? paths
        : paths.map((p) => ({ ...p, segments: straightSegments(p.stops) })),
    [paths, realRoutes],
  )
  // 建图与切天的回调都活在 effect 闭包里，重建地图的代价又太大 —— 走 ref 读当前档
  const sceneRef = useRef(scene)
  sceneRef.current = scene

  const hasScene = sceneBounds(paths, null) !== null

  // ── 地图生命周期 ──────────────────────────────────────────────
  useEffect(() => {
    if (!hasScene || !containerRef.current) return
    const map = new LibreMap({
      container: containerRef.current,
      style: STYLE_URL[readStyle()],
      bounds: sceneBounds(sceneRef.current, null)!,
      fitBoundsOptions: { padding: fitPadding(), maxZoom: 15 },
      attributionControl: { compact: true },
      pitch: readStyle() === '3d' ? 55 : 0,
    })
    mapRef.current = map
    map.addControl(new NavigationControl({ showCompass: false }))

    // 版权归属默认是**展开**的，390px 上那是一条 351px 宽、占满整行的白条，
    // 逼得底部所有浮层都得抬到它上面，白白让出一行。收成 ⓘ（maplibre 的 compact
    // 形态，点一下照样展开，归属没有丢）—— 这正是它自己在首次拖动时做的事，
    // 见 AttributionControl._updateCompactMinimize。
    //
    // 时序是这里的全部难点：建图那一刻属性列表还是空的（`maplibregl-attrib-empty`），
    // compact 态尚未建立，这时摘类没有意义 —— 样式加载完拿到归属后 `_updateCompact`
    // 会把 compact 与 compact-show 一起加回来。所以要等归属落定之后再摘。
    // 之后它只在「刚进入 compact 态」时才会再加，故摘一次即长期有效，
    // 只有用户点 ⓘ 才会重新展开。
    const collapseAttribution = (): void => {
      map
        .getContainer()
        .querySelector('.maplibregl-ctrl-attrib')
        ?.classList.remove('maplibregl-compact-show')
    }
    map.on('styledata', collapseAttribution)
    map.once('idle', collapseAttribution)

    map.on('style.load', () => {
      styleOkRef.current = true
      addSceneLayers(map, sceneRef.current, dayRef.current, styleKeyRef.current === '3d')
    })
    // 样式从未成功载入就报错 = 瓦片服务不可达 → 纸底 + 警告条，动线照画
    map.on('error', () => {
      if (!styleOkRef.current) {
        styleOkRef.current = true // 只降级一次
        setDegraded(true)
        map.setStyle(FALLBACK_STYLE)
      }
    })
    // 点地图空白收起小卡与样式切换器（pin 的点击在 marker 元素上已 stopPropagation）
    map.on('click', () => {
      setSelected(null)
      setStyleOpen(false)
    })

    drawMarkers(map)
    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
    // paths 随 trip 变；trip 变意味着整页数据换了，重建地图是对的
    // eslint 不在仓里，依赖列表人工核对：hasScene 由 paths 派生
  }, [paths, hasScene])

  // ── 天数切换：淡化 + fitBounds ────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (map.isStyleLoaded()) applyDim(map, paths, day)
    for (const m of markersRef.current) {
      const el = m.getElement()
      const active = day === null || Number(el.dataset['day']) === day
      // 起点旗只在看单独某一天时立着：全程图上五面旗一起插着全是噪声，
      // 而「哪儿是起点」本来就是盯住一天时才问的问题。淡化档也不留 —— 它不是背景信息。
      if (el.dataset['role'] === 'flag') {
        const show = day !== null && active
        m.setOpacity(show ? '1' : '0')
        el.style.pointerEvents = show ? 'auto' : 'none'
        continue
      }
      // 透明度必须走 Marker API：maplibre 每次重绘都会用内部 _opacity 重写
      // element.style.opacity（地形遮挡用的），硬写 style 会被 fitBounds 的动画抹掉 ——
      // 这正是「切天了但没看出淡化」的原因。filter 它不碰，直接写。
      m.setOpacity(active ? '1' : String(DIM_PIN))
      el.style.filter = active ? '' : DIM_FILTER
    }
    // 按当前档取框：真路会绕出站点包络之外，直连不会。切档本身不重取框（见下方 effect）
    const b = sceneBounds(sceneRef.current, day)
    if (b) map.fitBounds(b, { padding: fitPadding(), maxZoom: 15, duration: 600 })
    setSelected(null)
  }, [day, paths])

  // ── 动线画法切换：只换 source 的数据 ──────────────────────────
  // 不重建图层（会闪），也不重新 fitBounds —— 每点一次开关镜头都跳一下，很晕。
  // 四层 layer 按 `real` 过滤，直连档全段 real=false，于是虚线那两层接管全部段落。
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    for (const p of scene) {
      const src = map.getSource(`day-${p.dayIndex}`)
      if (src?.type === 'geojson') (src as GeoJSONSource).setData(sceneData(p))
    }
  }, [scene])

  // ── 选中地点：把它挪到「小卡之上」那块可视区的中心 ────────────
  // useLayoutEffect：要等小卡真的渲染出来才量得到高度，而它高度随事件条数变。
  useLayoutEffect(() => {
    const map = mapRef.current
    const box = containerRef.current
    if (!map || !box || !selected) return
    map.easeTo({
      center: selected.stop.coord,
      offset: cardFocusOffset(box.clientHeight, cardRef.current?.offsetHeight ?? 0),
      duration: 400,
    })
  }, [selected])

  // ── 底图样式切换 ──────────────────────────────────────────────
  const switchStyle = (key: StyleKey): void => {
    setStyleKey(key)
    setStyleOpen(false)
    writeViewState(STYLE_KEY, key)
    const map = mapRef.current
    if (!map || degraded) return
    map.setStyle(STYLE_URL[key])
    // setStyle 清掉自定义层，style.load 里 addSceneLayers 会重挂
    map.easeTo({ pitch: key === '3d' ? 55 : 0, duration: 400 })
  }

  const toggleRoutes = (): void => {
    const next = !realRoutes
    setRealRoutes(next)
    writeViewState(ROUTES_KEY, next ? 'real' : 'straight')
  }

  const drawMarkers = (map: LibreMap): void => {
    // 坐标重合的 pin 要错开，否则下面那枚既看不见也点不到（Astra 与它顶层的酒吧就是同一个坐标）。
    // 偏移量走 Marker 的 offset —— 挪的是像素，坐标和折线都还在真实位置上
    const offsets = pinOffsets(paths)
    for (const p of paths) {
      for (const stop of p.stops) {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'map-pin'
        el.style.background = p.color
        el.dataset['day'] = String(p.dayIndex)
        el.textContent = String(stop.seq)
        el.setAttribute(
          'aria-label',
          `${stop.name} · Day ${p.dayIndex} 第 ${stop.seq} 站${stop.origin === 'stay' ? '（今天从这里出发）' : ''}`,
        )
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          setSelected({ stop, dayIndex: p.dayIndex })
        })
        markersRef.current.push(
          new Marker({ element: el, offset: offsets.get(stopKey(p.dayIndex, stop.seq)) })
            .setLngLat(stop.coord)
            .addTo(map),
        )
      }

      // 起点旗：一天的动线常常是个圈（早上从酒店出门、晚上回酒店），
      // 首末两站还是同一个坐标 —— 光看一圈数字很难认出从哪儿开始。
      // 旗子跟着 1 号 pin 的错位量走，插在它上面：现有 pin 位置一枚不动。
      // 只在看单独某一天时才立（见切天那个 effect）——「起点在哪」是看一天时的问题。
      const first = p.stops[0]
      if (!first) continue
      const flag = document.createElement('button')
      flag.type = 'button'
      flag.className = 'map-flag'
      flag.dataset['day'] = String(p.dayIndex)
      flag.dataset['role'] = 'flag'
      flag.setAttribute('aria-label', `Day ${p.dayIndex} 从「${first.name}」出发`)
      flag.innerHTML = FLAG_SVG
      flag.addEventListener('click', (e) => {
        e.stopPropagation()
        setSelected({ stop: first, dayIndex: p.dayIndex })
      })
      markersRef.current.push(
        new Marker({
          element: flag,
          offset: startFlagOffset(offsets.get(stopKey(p.dayIndex, first.seq)) ?? [0, 0]),
        })
          .setLngLat(first.coord)
          .addTo(map),
      )
    }
  }

  const onShowInList = (eventId: string): void => {
    navigate('../list', { state: { focus: eventId } })
  }

  if (!hasScene) {
    return (
      <Problem
        title="地图还画不出来"
        detail="地点表里还没有带坐标的地点。在 trip-places 里给地点加 coord: 纬度, 经度 即可。"
      />
    )
  }

  const selectedPlace = selected ? places.get(selected.stop.placeId) : undefined
  /** 抽屉展开时右下角整列淡出 —— 透明还能点是最难查的一类 bug，命中一起关掉 */
  const chipHit = styleOpen ? 'pointer-events-none' : 'pointer-events-auto'

  // 换站只在当天之内走；换完 selected 变化，上面那个 layout effect 会顺带把镜头挪过去
  const neighbors = selected
    ? stopNeighbors(paths, selected.dayIndex, selected.stop.seq)
    : { prev: null, next: null }
  const goToStop = (stop: DayStop | null): void => {
    if (stop && selected) setSelected({ stop, dayIndex: selected.dayIndex })
  }

  return (
    <div className="flex h-[calc(100dvh-var(--nav-h))] flex-col" data-testid="map-view">
      {/*
        降级警告占自己的一行，不浮在地图上 —— 浮层会压住页签和缩放按钮
        （同 z-10、DOM 靠后就赢），而调 z-index 只是把遮挡换个方向。
        地图区域相应变矮，重叠在结构上就不可能发生。
      */}
      {degraded && (
        <div
          className="shrink-0 border-b border-[var(--hairline)] bg-paper px-4 py-1.5
                     text-center text-[12px] text-graphite"
        >
          底图加载失败（检查网络）—— 动线仍照常显示
        </div>
      )}

      <div className="relative flex-1">
        {/*
          定位写内联 style：maplibre 的 .maplibregl-map 自带 position:relative，
          且它的 CSS 随懒加载 chunk 在 Tailwind 之后注入 —— 类写法会被同特异性
          后来者翻掉（容器高度塌 0、canvas 落 300px 默认值，真踩过）。
        */}
        <div ref={containerRef} className="bg-sunken" style={{ position: 'absolute', inset: 0 }} />

        {/* 天数页签 —— 浮在地图上方居中 */}
        <div className="pointer-events-none absolute inset-x-0 top-2.5 z-10 flex justify-center">
          <div className="pointer-events-auto max-w-full overflow-x-auto px-2 [scrollbar-width:none]">
            <Segmented
              ariaLabel="按天筛选"
              className="shadow-[var(--shadow)]"
              options={[
                { key: 'all', label: '全程' },
                ...trip.days.map((d) => ({ key: String(d.index), label: `D${d.index}` })),
              ]}
              value={day === null ? 'all' : String(day)}
              onChange={(k) => setDay(k === 'all' ? null : Number(k))}
              itemClass="px-3 py-[3px] text-[12.5px] whitespace-nowrap"
            />
          </div>
        </div>

        {/*
          底图样式切换器（Google Maps 左下角的做法）：平时只占一枚 chip 显示当前样式，
          点它向右滑出其余三个，选完立刻收回。四选一的语义没变，变的只是占地。

          触发 chip 常驻最左且不参与滑出 —— 否则当前项会随选择在行内跳位置。
          容器 pointer-events-none、只在按钮上放行：这个浮层横跨到地图中部，
          透明区照样吞点击（spec 里记过的坑，截图看不出来）。
        */}
        <div className="pointer-events-none absolute bottom-2 left-2 z-10 flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setStyleOpen((v) => !v)
              setMissingOpen(false)
            }}
            aria-expanded={styleOpen}
            aria-label={`底图样式：${styleKey}`}
            className={`pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 text-[12px]
                        shadow-[var(--shadow)] ${segChip(true)}`}
          >
            <Layers size={13} aria-hidden />
            {styleKey}
          </button>
          {/*
            抽屉：外层裁剪并让出宽度，内层整体从触发 chip 背后滑出来。
            只做 max-width 的话内容是「原地被揭开」而不是「滑出来」，没有抽屉感；
            内层的位移跑满整个时长，也顺带盖住了 max-width 提前到位后的那段空转。
            -my-1.5 配 py-1.5：overflow-hidden 会连上下的投影一起裁掉，得撑出余量。
          */}
          <div
            className={`-my-1.5 overflow-hidden py-1.5 transition-[max-width] duration-300 ease-out
                        ${styleOpen ? 'max-w-[15rem]' : 'max-w-0'}`}
          >
            <div
              className={`flex gap-1 transition-transform duration-300 ease-out
                          ${styleOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
              {STYLE_KEYS.filter((k) => k !== styleKey).map((k) => (
                <button
                  key={k}
                  type="button"
                  tabIndex={styleOpen ? 0 : -1}
                  onClick={() => switchStyle(k)}
                  className={`pointer-events-auto whitespace-nowrap px-2.5 py-1 text-[12px]
                              shadow-[var(--shadow)] ${segChip(false)}`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/*
          右下角一列：上面是缺坐标提示（点开列名单，补数据的工作清单），
          下面是动线画法开关 —— 最常点的那枚离角最近，手机上拇指够得着。

          容器 pointer-events-none：items-end 让它的盒子有最宽子元素那么宽（w-56），
          展开时会横跨到左下角样式 chip 上方 —— 视觉上不挡，却把点击吃掉。
          事件只在真正画出来的子元素上放行。

          抽屉展开时整列淡出让位：390px 上放大字号后的抽屉要占 250px，两者挤不进同一行。
          淡出而不是换行 —— 抽屉选完就收，让位是瞬时的；多堆一行反而把底部又占回去。
          淡出的同时必须连命中一起关（chipHit），否则就是「看不见却还能点」。
        */}
        <div
          className={`pointer-events-none absolute right-10 bottom-2 z-10 flex flex-col items-end
                      gap-1 transition-opacity duration-200 ${styleOpen ? 'opacity-0' : 'opacity-100'}`}
        >
          {missingOpen && missing.length > 0 && (
            <ul
              className={`${chipHit} max-h-48 w-56 overflow-y-auto rounded-lg border border-[var(--hairline)]
                         bg-raised p-2.5 text-[11.5px] leading-relaxed text-soft shadow-[var(--shadow)]`}
            >
              {missing.map((p) => (
                <li key={p.id} className="truncate">
                  {p.name}
                </li>
              ))}
            </ul>
          )}
          {missing.length > 0 && (
            <button
              type="button"
              onClick={() => setMissingOpen((v) => !v)}
              aria-expanded={missingOpen}
              className={`${chipHit} px-2.5 py-1 text-[12px] shadow-[var(--shadow)] ${segChip(missingOpen)}`}
            >
              {missing.length} 个地点缺坐标
            </button>
          )}
          {/* 两态直接点切，不做抽屉 —— 抽屉是为四选一准备的，两态用它只是多一次点击 */}
          <button
            type="button"
            onClick={toggleRoutes}
            aria-pressed={!realRoutes}
            aria-label={`动线画法：${realRoutes ? '真实路网' : '站点直连'}，点击切换`}
            className={`${chipHit} flex items-center gap-1.5 px-2.5 py-1 text-[12px]
                        shadow-[var(--shadow)] ${segChip(true)}`}
          >
            {realRoutes ? <Route size={13} aria-hidden /> : <Waypoints size={13} aria-hidden />}
            {realRoutes ? '真路' : '直连'}
          </button>
        </div>

        {selected && selectedPlace && (
          <PlaceCard
            ref={cardRef}
            stop={selected.stop}
            dayIndex={selected.dayIndex}
            color={paths.find((p) => p.dayIndex === selected.dayIndex)?.color ?? 'var(--ink)'}
            onPrev={neighbors.prev ? () => goToStop(neighbors.prev) : undefined}
            onNext={neighbors.next ? () => goToStop(neighbors.next) : undefined}
            place={selectedPlace}
            events={selected.stop.eventIds
              .map((id) => events.get(id))
              .filter((e): e is NonNullable<typeof e> => e !== undefined)}
            onClose={() => setSelected(null)}
            onShowInList={onShowInList}
          />
        )}
      </div>
    </div>
  )
}

/** fitBounds 的内边距：顶部让开页签，底部让开 chip 行（版权收成 ⓘ 后不再占一行） */
function fitPadding(): { top: number; bottom: number; left: number; right: number } {
  return { top: 64, bottom: 48, left: 40, right: 40 }
}

/**
 * 把每天的动线挂上去。每天一个 source（各段是一个 Feature，带 `real` 属性），
 * 三层 layer：白色描边线在下（bright/liberty 彩底会吞掉裸彩线），
 * 其上按 `real` 分成实线与虚线两层。
 *
 * 实线 = 预计算的真实路网，虚线 = 两点直连的兜底。这个区别留在图上是有意的：
 * 哪几段是真路、哪几段还只是估计，一眼看得出来，不用去查文档。
 * 样式切换后由 style.load 重挂。
 */
/** 沿线每隔多少像素摆一个方向箭头。箭头变大就得跟着放宽，否则挤成一串 */
const ARROW_SPACING = 105

/**
 * 方向箭头的图标：**朝右**的实心三角 + 米色描边，当天色填充。
 *
 * 必须画成朝右：`symbol-placement: 'line'` 会把图标按线的走向旋转，
 * 而它认的 0° 就是朝右。画成朝上，满图箭头就全歪 90°。
 *
 * 用 2 倍图（`pixelRatio: 2`）配 canvas —— 直接画 1 倍在高密屏上是毛的。
 */
function arrowImage(color: string): ImageData {
  const s = 34 // 2 倍图边长；落到屏幕上是 17px（约等于 pin 直径的 3/4）
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const g = c.getContext('2d')!
  g.beginPath()
  g.moveTo(s * 0.82, s / 2)
  g.lineTo(s * 0.2, s * 0.16)
  g.lineTo(s * 0.36, s / 2)
  g.lineTo(s * 0.2, s * 0.84)
  g.closePath()
  g.fillStyle = color
  g.strokeStyle = '#fffdf6'
  g.lineWidth = 3.4
  g.lineJoin = 'round'
  g.stroke() // 先描边后填充：白边只留在外圈，不啃掉本来就不大的实心部分
  g.fill()
  return g.getImageData(0, 0, s, s)
}

/**
 * 一天的动线喂给 source 的形状：**一段一个 Feature**，带 `real` 属性。
 * 分段而不是一条整线，是因为实线与虚线要按段过滤成不同图层。
 * 建层时与切换画法时共用一份 —— 两处形状必须一样，否则切一次就变形。
 */
function sceneData(p: DayPath): Extract<
  GeoJSONSourceSpecification['data'],
  { type: 'FeatureCollection' }
> {
  return {
    type: 'FeatureCollection',
    features: p.segments.map((s) => ({
      type: 'Feature',
      properties: { real: s.real },
      geometry: { type: 'LineString', coordinates: s.coords },
    })),
  }
}

function addSceneLayers(
  map: LibreMap,
  paths: DayPath[],
  day: number | null,
  threeD: boolean,
): void {
  for (const p of paths) {
    if (p.segments.length === 0) continue
    const id = `day-${p.dayIndex}`
    if (map.getSource(id)) continue
    map.addSource(id, { type: 'geojson', data: sceneData(p) })
    const active = day === null || day === p.dayIndex
    const casing = dashCasing(EST_WIDTH, EST_DASH)
    // 描边也得跟着分实虚：一条**连续**的白描边压在虚线底下，会让兜底直连
    // 看起来跟真路一样结实 —— 那正是这个功能要区分的东西
    map.addLayer({
      id: `${id}-casing`,
      type: 'line',
      source: id,
      filter: ['==', ['get', 'real'], true],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#fffdf6', 'line-width': 5, 'line-opacity': active ? 0.9 : DIM_LINE },
    })
    map.addLayer({
      id: `${id}-est-casing`,
      type: 'line',
      source: id,
      filter: ['==', ['get', 'real'], false],
      paint: {
        'line-color': '#fffdf6',
        'line-width': casing.width,
        'line-dasharray': casing.dasharray,
        'line-opacity': active ? 0.9 : DIM_LINE,
      },
    })
    map.addLayer({
      id,
      type: 'line',
      source: id,
      filter: ['==', ['get', 'real'], true],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': p.color,
        'line-width': 3,
        'line-opacity': active ? 0.9 : DIM_LINE,
      },
    })
    map.addLayer({
      id: `${id}-est`,
      type: 'line',
      source: id,
      filter: ['==', ['get', 'real'], false],
      paint: {
        'line-color': p.color,
        'line-width': EST_WIDTH,
        'line-dasharray': [EST_DASH, EST_DASH],
        'line-opacity': active ? 0.85 : DIM_LINE,
      },
    })

    /*
      方向箭头。一天的动线常常是个圈，光看线不知道往哪边转。

      沿线每隔 ARROW_SPACING 摆一个：长段排好几个、跟着真路的弯道走，
      短腿可能一个都放不下 —— 那种腿看序号就够了。

      **图标是自己画的图片，不是 Unicode 三角**：字符要底图样式的字形包，
      断网降级到纸底时没有字形，控制台直接报错。图片两档都稳，也能上当天色。
      不过滤 `real` —— 真路与直连两档共用这一层，切档时箭头跟着 setData 自己变。
    */
    const arrow = `jjj-arrow-${p.dayIndex}`
    if (!map.hasImage(arrow)) map.addImage(arrow, arrowImage(p.color), { pixelRatio: 2 })
    map.addLayer({
      id: `${id}-arrow`,
      type: 'symbol',
      source: id,
      layout: {
        'icon-image': arrow,
        'symbol-placement': 'line',
        'symbol-spacing': ARROW_SPACING,
        // 跟着地图转（而不是始终朝屏幕上方）—— 它表示的是路的走向
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': false,
        'icon-padding': 4,
      },
      paint: { 'icon-opacity': active ? 1 : DIM_LINE },
    })
  }
  // 3d：liberty 底上加建筑挤出层（OpenMapTiles 的 building 层带 render_height）
  if (threeD && !map.getLayer('jjj-3d-buildings') && map.getSource('openmaptiles')) {
    map.addLayer({
      id: 'jjj-3d-buildings',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': '#d9d0be',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.55,
      },
    })
  }
}

/** 天数切换时只调透明度，不重建层 */
function applyDim(map: LibreMap, paths: DayPath[], day: number | null): void {
  for (const p of paths) {
    const id = `day-${p.dayIndex}`
    if (!map.getLayer(id)) continue
    const active = day === null || day === p.dayIndex
    map.setPaintProperty(id, 'line-opacity', active ? 0.9 : DIM_LINE)
    map.setPaintProperty(`${id}-est`, 'line-opacity', active ? 0.85 : DIM_LINE)
    map.setPaintProperty(`${id}-casing`, 'line-opacity', active ? 0.9 : DIM_LINE)
    map.setPaintProperty(`${id}-est-casing`, 'line-opacity', active ? 0.9 : DIM_LINE)
    // 箭头与线同档淡化 —— 留着不淡就成了「淡线上飘着一排亮箭头」
    if (map.getLayer(`${id}-arrow`)) {
      map.setPaintProperty(`${id}-arrow`, 'icon-opacity', active ? 1 : DIM_LINE)
    }
  }
}
