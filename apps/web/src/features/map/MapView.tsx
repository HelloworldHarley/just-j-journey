import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers } from 'lucide-react'
import { Map as LibreMap, Marker, NavigationControl, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Trip } from '@jjj/schema'
import {
  cardFocusOffset,
  dayPaths,
  missingCoords,
  sceneBounds,
  stopNeighbors,
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

  const hasScene = sceneBounds(paths, null) !== null

  // ── 地图生命周期 ──────────────────────────────────────────────
  useEffect(() => {
    if (!hasScene || !containerRef.current) return
    const map = new LibreMap({
      container: containerRef.current,
      style: STYLE_URL[readStyle()],
      bounds: sceneBounds(paths, null)!,
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
      addSceneLayers(map, paths, dayRef.current, styleKeyRef.current === '3d')
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
      // 透明度必须走 Marker API：maplibre 每次重绘都会用内部 _opacity 重写
      // element.style.opacity（地形遮挡用的），硬写 style 会被 fitBounds 的动画抹掉 ——
      // 这正是「切天了但没看出淡化」的原因。filter 它不碰，直接写。
      m.setOpacity(active ? '1' : String(DIM_PIN))
      el.style.filter = active ? '' : DIM_FILTER
    }
    const b = sceneBounds(paths, day)
    if (b) map.fitBounds(b, { padding: fitPadding(), maxZoom: 15, duration: 600 })
    setSelected(null)
  }, [day, paths])

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

  const drawMarkers = (map: LibreMap): void => {
    for (const p of paths) {
      for (const stop of p.stops) {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'map-pin'
        el.style.background = p.color
        el.dataset['day'] = String(p.dayIndex)
        el.textContent = String(stop.seq)
        el.setAttribute('aria-label', `${stop.name} · Day ${p.dayIndex} 第 ${stop.seq} 站`)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          setSelected({ stop, dayIndex: p.dayIndex })
        })
        markersRef.current.push(
          new Marker({ element: el }).setLngLat(stop.coord).addTo(map),
        )
      }
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
  /** 抽屉展开时缺坐标 chip 淡出 —— 透明还能点是最难查的一类 bug，命中一起关掉 */
  const missingHit = styleOpen ? 'pointer-events-none' : 'pointer-events-auto'

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
          缺坐标提示：右下角 chip，点开列名单（下一轮 Agent 补数据的工作清单）。
          容器 pointer-events-none：items-end 让它的盒子有最宽子元素那么宽（w-56），
          展开时会横跨到左下角样式 chip 上方 —— 视觉上不挡，却把点击吃掉。
          事件只在真正画出来的子元素上放行。

          抽屉展开时它整体淡出让位：390px 上放大字号后的抽屉要占 250px，两者挤不进同一行。
          淡出而不是换行 —— 抽屉选完就收，让位是瞬时的；多堆一行反而把底部又占回去。
          淡出的同时必须连命中一起关（missingHit），否则就是「看不见却还能点」。
        */}
        {missing.length > 0 && (
          <div
            className={`pointer-events-none absolute right-10 bottom-2 z-10 flex flex-col items-end
                        gap-1 transition-opacity duration-200 ${styleOpen ? 'opacity-0' : 'opacity-100'}`}
          >
            {missingOpen && (
              <ul
                className={`${missingHit} max-h-48 w-56 overflow-y-auto rounded-lg border border-[var(--hairline)]
                           bg-raised p-2.5 text-[11.5px] leading-relaxed text-soft shadow-[var(--shadow)]`}
              >
                {missing.map((p) => (
                  <li key={p.id} className="truncate">
                    {p.name}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setMissingOpen((v) => !v)}
              aria-expanded={missingOpen}
              className={`${missingHit} px-2.5 py-1 text-[12px] shadow-[var(--shadow)] ${segChip(missingOpen)}`}
            >
              {missing.length} 个地点缺坐标
            </button>
          </div>
        )}

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
 * 把每天的动线挂成两层 layer：白色描边线在下（bright/liberty 彩底会吞掉裸彩线），
 * 天色虚线在上。样式切换后由 style.load 重挂。
 */
function addSceneLayers(
  map: LibreMap,
  paths: DayPath[],
  day: number | null,
  threeD: boolean,
): void {
  for (const p of paths) {
    if (p.line.length < 2) continue
    const id = `day-${p.dayIndex}`
    if (map.getSource(id)) continue
    map.addSource(id, {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: p.line } },
    })
    const active = day === null || day === p.dayIndex
    map.addLayer({
      id: `${id}-casing`,
      type: 'line',
      source: id,
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': '#fffdf6', 'line-width': 5, 'line-opacity': active ? 0.9 : DIM_LINE },
    })
    map.addLayer({
      id,
      type: 'line',
      source: id,
      paint: {
        'line-color': p.color,
        'line-width': 2.5,
        'line-dasharray': [2, 2],
        'line-opacity': active ? 0.85 : DIM_LINE,
      },
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
    map.setPaintProperty(id, 'line-opacity', active ? 0.85 : DIM_LINE)
    map.setPaintProperty(`${id}-casing`, 'line-opacity', active ? 0.9 : DIM_LINE)
  }
}
