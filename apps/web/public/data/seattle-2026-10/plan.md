---
id: seattle-2026-10
title: 西雅图 5 天 4 夜
destination: Seattle, WA, USA
timezone: America/Los_Angeles
start: 2026-10-01
end: 2026-10-05
travelers: 2
currency: USD
---

# 西雅图 5 天 4 夜

## 硬约束

```trip-constraints
- kind: arrive
  at: 2026-10-01 10:40
  label: 她抵达 SEA · 国际航班
  note: 我 10:05 先落地，坐 Link 一站去 Tukwila 提车，开回航站楼接她。她过海关取行李约 11:45–12:15 出来，有 Global Entry 约 11:30
- kind: deadline
  at: 2026-10-05 08:30
  label: 必须还完车（Tukwila 轻轨站）
  note: 倒推链 08:45 进航站楼 ← 08:30 Link 到机场站 ← 08:25 还完车 ← 07:40 Southcenter 超充补电 ← 07:15 出酒店。合同截止 09:00，留半小时余量
- kind: depart
  at: 2026-10-05 10:10
  label: 我起飞 · DL 1001
  note: 国内线不托运，08:45 进航站楼直接安检
- kind: depart
  at: 2026-10-05 11:45
  label: 她起飞 · CX 853
  note: 国际航班，08:45 进航站楼有 3 小时。和我一起到机场，分头安检
```

## 长途

```trip-transports
- what: 去程 · 汇合
  transport:
    - {traveler: 她, mode: flight, carrier: 大韩航空, from: PVG T1, to: SEA, dep_time: "11:10", arr_time: "10:40", arr_date: 2026-10-01, duration: 14h30m, baggage: 1 件 · 直挂, refund: 出票 24 小时内可免费取消, price: "$713.33", stops: [{airport: ICN T2, arr_time: "14:20", dep_time: "16:40", leg: 2h10m, wait: 2h20m}], legs: [{number: KE 882, cabin: Economy Saver, seat: 48J}, {number: KE 41, cabin: Economy Saver, seat: 35J}]}
    - {traveler: 我, mode: flight, carrier: 达美, number: DL 3687, from: SNA A, to: SEA, dep_time: "07:00", arr_time: "10:05", duration: 3h05m, cabin: Delta Main Basic, baggage: 0 件, price: "往返 $226.80"}
- what: 返程 · 各自起飞
  transport:
    - {traveler: 我, mode: flight, carrier: 达美, number: DL 1001, from: SEA, to: SNA A, dep_time: "10:10", arr_time: "13:11", duration: 3h01m, cabin: Delta Main Basic, baggage: 0 件, note: 与去程同一张往返票，票价计在去程}
    - {traveler: 她, mode: flight, carrier: 国泰航空, from: SEA, to: PVG T2, dep_time: "11:45", arr_time: "22:10", arr_day_offset: 1, duration: 19h25m, baggage: 1 件 · 直挂, price: "$949.60", stops: [{airport: HKG T1, arr_date: 2026-10-06, arr_time: "16:45", dep_time: "19:20", leg: 14h0m, wait: 2h35m}], legs: [{number: CX 853, cabin: Economy Light}, {number: CX 362, cabin: Economy Light}], note: 与去程分开的两张单程票，改签互不影响}
```

## 住宿

```trip-stays
- what: Mt. Rainier Getaway
  platform: Airbnb
  from: "2026-10-01 18:30"
  to: "2026-10-02 08:00"
  cost: $339.42
  room: 独栋木屋 · 自助入住/退房
  parking: 含 · 门口 · 免费特斯拉充电桩
  breakfast: 不含
  refund: 9/26 16:00 前可免费取消
- what: AC Hotel
  platform: 万豪 · AC Hotels
  from: "2026-10-02 20:50"
  to: "2026-10-05 07:15"
  stars: 4
  parking: 不含 · 停 SpotHero 地库
```

## 租车

```trip-rentals
- what: Tesla Model Y
  platform: Turo
  from: "2026-10-01 10:30"
  to: "2026-10-05 09:00"
  cost: $343.60
  pickup: Tukwila 轻轨站
  dropoff: Tukwila 轻轨站
  mileage: 2000 英里
  refund: 不可退
```

## 地点表

```trip-places
- name: SEA 机场
  en: Seattle-Tacoma International Airport
  coord: 47.4435, -122.2961
  category: flight
  note: 坐标取航站楼正门（International Blvd），不是机场几何中心 —— 自驾路线要能算
- name: Tukwila 轻轨站
  en: Tukwila International Boulevard Station
  coord: 47.4639, -122.2878
  category: transit
  note: 3651 Southcenter Blvd。Turo 交/还车点，机场 Link 北行一站
- name: Southcenter 超充
  en: Tesla Supercharger Southcenter Tukwila
  coord: 47.4553, -122.2566
  category: logistics
  note: 333 Strander Blvd，16 桩 250 kW。离交车点 5 分钟、离大华 3 分钟、离 Kent 烤肉 10 分钟
- name: Sharps RoastHouse
  en: Sharps RoastHouse SeaTac WA
  coord: 47.4360, -122.2966
  category: food
  note: 18427 International Blvd，机场跑道边。坐标约，订位前核对
- name: 99 Ranch 大华
  en: 99 Ranch Market Kent WA
  coord: 47.4415, -122.2242
  category: logistics
  note: Great Wall Mall（18230 E Valley Hwy），坐标约
- name: Tehaleh Rainier View Point
  en: Tehaleh Rainier View Point Bonney Lake WA
  coord: 47.1290, -122.1758
  category: viewpoint
  note: 坐标待现场核对，Nominatim 查不到
- name: Longmire
  en: Longmire Mount Rainier National Park
  coord: 46.7502, -121.8120
  category: outdoor
- name: Mt. Rainier Getaway
  en: 31222 555th Street East Ashford WA 98304
  coord: 46.7550, -122.0200
  category: homestay
  note: 坐标按门牌地址精确定位（OSM）。Ashford 镇东侧私人社区，距 Nisqually 园门约 10 分钟车程
- name: Paradise
  en: Paradise Jackson Visitor Center Mount Rainier
  coord: 46.7860, -121.7355
  category: outdoor
- name: Narada Falls
  en: Narada Falls Mount Rainier
  coord: 46.7750, -121.7459
  category: viewpoint
- name: 倒影湖
  en: Reflection Lakes Mount Rainier
  coord: 46.7690, -121.7290
  category: outdoor
- name: Stevens Canyon Road
  en: Stevens Canyon Road Mount Rainier
  coord: 46.7580, -121.6400
  category: viewpoint
- name: Tipsoo Lake
  en: Tipsoo Lake Mount Rainier
  coord: 46.8690, -121.5170
  category: outdoor
- name: Asadero Sinaloa
  en: Asadero Prime Kent WA
  coord: 47.3831, -122.2470
  category: food
  note: 实际店名 Asadero Prime，310 Washington Ave N, Kent
- name: AC Hotel
  en: AC Hotel by Marriott Seattle Downtown
  coord: 47.6191, -122.3308
  category: hotel
  note: 117 Yale Ave N，South Lake Union / Denny Triangle —— 坐标按门牌地址精确定位（OSM）。步行 8 分钟到 Kenmore Air 码头、10 分钟到玻璃球
- name: 派克市场
  en: Pike Place Market
  coord: 47.6097, -122.3422
  category: food
- name: 亚马逊玻璃球
  en: Amazon Spheres Seattle
  coord: 47.6155, -122.3390
  category: sight
- name: Kenmore Air 联合湖码头
  en: Kenmore Air Lake Union Seaplane Terminal
  coord: 47.6280, -122.3395
  category: experience
- name: Seattle Center
  en: Seattle Center
  coord: 47.6221, -122.3540
  category: sight
- name: 单轨 Seattle Center 站
  en: Seattle Center Monorail Station
  coord: 47.6212, -122.3495
  category: transit
- name: 凯里公园
  en: Kerry Park Seattle
  coord: 47.6295, -122.3599
  category: viewpoint
- name: How to Cook a Wolf
  en: How to Cook a Wolf Queen Anne Seattle
  coord: 47.6387, -122.3567
  category: food
- name: Colman Dock 渡轮码头
  en: Colman Dock Seattle Ferry Terminal Pier 52
  coord: 47.6021, -122.3389
  category: transit
- name: Bainbridge 渡轮码头
  en: Bainbridge Island Ferry Terminal
  coord: 47.6222, -122.5100
  category: transit
- name: Sequim 超充
  en: Tesla Supercharger Sequim WA
  coord: 48.0708, -123.0738
  category: logistics
  note: 1441 E Washington St（Holiday Inn Express 停车场），8 桩 150 kW
- name: Olympic Game Farm
  en: Olympic Game Farm Sequim WA
  coord: 48.1335, -123.1478
  category: experience
  note: 1423 Ward Rd。秋季 09:00–16:00，闭园前 45 分钟停止入场
- name: Lake Crescent Lodge
  en: Lake Crescent Lodge Olympic National Park
  coord: 48.0571, -123.8000
  category: food
  note: 416 Lake Crescent Rd，湖边老木屋旅馆，餐厅 Singer's Table 供午餐
- name: Marymere Falls 步道口
  en: Storm King Ranger Station Marymere Falls Trailhead
  coord: 48.0579, -123.7886
  category: outdoor
  note: Storm King 护林站停车场（护林站本身季节性关闭，步道照常开放）
- name: 飓风岭
  en: Hurricane Ridge Visitor Center Olympic National Park
  coord: 47.9692, -123.4865
  category: viewpoint
  note: 坐标取 Hurricane Ridge Road 终点停车场（OSM 路网）。海拔 5,242 英尺，游客中心 2023 年烧毁，山顶服务有限、厕所是移动式
- name: Next Door Gastropub
  en: Next Door Gastropub Port Angeles WA
  coord: 48.1194, -123.4341
  category: food
  note: 113 W Front St，Port Angeles 市中心
```

## Day 1 · 2026-10-01

```trip-day
theme: 双城落地汇合，提车南下雪山脚
sunrise: "07:07"
sunset: "18:52"
```

时差日，也是搬运日。今天的主线只有一条：汇合、补给、进山 —— 木屋和早睡是给明天 8 点出门存的本钱。

### 抵达 SEA · 我先落地

```trip-event
time: "10:05"
category: flight
place: SEA 机场
detail: 去程 · 汇合
to_next: {mode: rail, minutes: 15, label: 到达层走到 Link 站约 10 分钟，北行一站 3 分钟到 Tukwila International Blvd, note: ORCA 或手机刷闸机，$3 左右}
```

我 10:05 落地，国内线不托运，10:20 前就能出来 —— **不等她，直接坐 Link 去提车**。

她 10:40 落地，开始过海关取行李，正好是我提车的窗口。

### 提车 · Tesla Model Y

```trip-event
time: 10:40–11:00
category: drive
place: Tukwila 轻轨站
detail: Tesla Model Y
booking: {status: booked}
notes:
  - 拍全车视频存证 / 看一眼电量和轮胎 / 问清还车电量要求
  - 有 FSD 辅助驾驶 —— 先在 I-5 上熟悉一段再上山路，别在盘山路第一次开
to_next: {mode: drive, minutes: 10, label: 开回航站楼，国际到达层外接客道等她}
```

Turo 车主在轻轨站交车，一个人办手续最快。提完车开回航站楼，**卡着她出关的点在到达层外接**。

### 接她 · 汇合

```trip-event
time: 11:45–12:15
category: logistics
place: SEA 机场
flags: [warning]
to_next: {mode: drive, minutes: 10, label: 出机场上 WA-518 转南下}
```

她**过海关 + 取行李约 11:45–12:15 出来，有 Global Entry 约 11:30**。出来直接上车，行李进后备箱就走。

### 午餐 · 机场边的烟熏烤肉

```trip-event
time: 12:25–13:30
category: food
place: Sharps RoastHouse
cost: 约 $30/人
to_next: {mode: drive, minutes: 15, label: 去 Kent 的大华}
```

**Sharps RoastHouse** —— 机场跑道边的烟熏烤肉老店（每天 11:00 开门），落地第一餐直接进入美式节奏。

备选：**13 Coins SeaTac**（24 小时老牌餐馆，早餐全天供应）。

### 补货 · 99 Ranch 大华

```trip-event
time: 13:45–14:30
category: logistics
place: 99 Ranch 大华
flags: [warning]
notes:
  - 别跳过这一站：Ashford 晚上没有可靠补给，明天雷尼尔全线更是没有任何吃饭的地方
  - 买：水、零食、明早的咖啡面包、今晚的晚餐食材（木屋有灶台）
  - "自热锅是明天中午背上山的午饭 —— 按人头买够，再配点干粮"
  - "提车时电量低于 60% 就顺手去 3 分钟外的 Southcenter 超充补 15 分钟 —— 到木屋之前没有别的桩"
to_next: {mode: drive, minutes: 40, label: WA-167 经 Puyallup 转 410 往 Bonney Lake 方向}
```

Great Wall Mall 里的大华超市，自热锅、亚洲零食一站配齐。

### Tehaleh 雪山合影

```trip-event
time: 15:15–15:40
category: viewpoint
place: Tehaleh Rainier View Point
flags: [optional]
to_next: {mode: drive, minutes: 110, label: 走 Orting-Kapowsin / Eatonville 进 Nisqually 门到 Longmire，64 英里乡道}
```

Bonney Lake 南边的观景台，零遮挡，巨大的雷尼尔怼在眼前 —— **全程最好的车 + 雪山合影机位**，顺路小绕。

累了就跳过直接南下，明天一整天都是雪山。

### Longmire 历史区

```trip-event
time: 17:30–18:05
category: outdoor
place: Longmire
flags: [optional]
cost: 雷尼尔门票 $30/车（7 天有效）
notes:
  - 来得及且精力允许才进 —— Nisqually 门再开 10 分钟就到；跳过 Tehaleh 的话能提早一小时到这
  - 今天买的门票 7 天有效，明天进山直接用
to_next: {mode: drive, minutes: 25, label: 出园回木屋}
```

古木、苔藓、1899 年的老屋群，**Trail of the Shadows** 0.7 英里平地环线正好舒展一下飞了一天的腿。

### 入住 Mt. Rainier Getaway

```trip-event
time: "18:30"
category: homestay
place: Mt. Rainier Getaway
detail: Mt. Rainier Getaway
booking: {status: booked}
notes:
  - 自助入住/退房，她航班晚点也进得去 —— 门锁密码提前离线存好
  - "到了先插充电桩（房源免费）—— 明天 220 英里山路，出发要满电"
  - 山区夜里 4–7°C，厚外套 + 拖鞋
  - 睡前查一次 NPS 步道状况，Paradise 结冰就把冰爪备在包顶
  - 时差克星是早睡 —— 明早 08:00 出门
```

晚餐两条路：**木屋有灶台**，用大华买的食材简单做点；或者干脆路上解决 —— **Copper Creek Inn**（园门方向 7 分钟，黑莓派是招牌）约 20:00 打烊，来得及。

**自热锅别动** —— 那是明天中午山上的午饭。

## Day 2 · 2026-10-02

```trip-day
theme: 雷尼尔环线，夜宿回城
sunrise: "07:08"
sunset: "18:50"
```

**⚠️ 全程最长的一天：8:00 出门，20:50 进酒店（跳过日落场 19:10 就到）。**

**周五进山比周末松一大截** —— 停车、步道、机位都是。

**为什么是 Glacier Vista 这条线：** 中等强度就把最值钱的景拿全了 —— 上山正前方一路是**雷尼尔和尼斯阔利冰川**，回程加走 Myrtle Falls 拿明信片机位，出园顺路再收 Narada Falls。Panorama Point 以上的雪原、碎石和 430 米爬升整段让掉，膝盖和体力都留给后面三天。

**电量：** 满电出门，全天约 220 英里含 5,400 英尺爬升，回城前在 Southcenter 超充补一次 —— 正好在 Kent 烤肉和市区之间。

### 出发 · 西南门

```trip-event
time: "08:00"
category: logistics
place: Mt. Rainier Getaway
to_next: {mode: drive, minutes: 60, km: 26, label: 木屋 → Nisqually 门约 10 分钟 → Paradise 约 50 分钟（18 英里盘山）}
```

不用摸黑起，8 点出门 **9 点到 Paradise，周五这个点停车还稳**（周末 10 点后就满了）。

早餐吃昨晚买的。想喝正经咖啡：Ashford 的 **Whittaker's** espresso 吧开得早。**行李全部装车、拔充电线、自助退房** —— 今晚直接回市区，不回木屋。

### Paradise · Glacier Vista + Myrtle Falls

```trip-event
time: 09:00–12:00
category: outdoor
place: Paradise
flags: [warning]
cost: 雷尼尔门票 $30/车（7 天有效）
notes:
  - 昨天进过 Longmire 的话门票已买，直接刷
  - "全天山里没有任何吃饭的地方 —— 自热锅 + 干粮背上山，午饭在 Glacier Vista 解决"
  - 清晨步道结霜，轻便冰爪（microspikes）+ 登山杖带上 —— 早上停车场有步道状况告示板，结冰就穿
to_next: {mode: drive, minutes: 10, label: 出 Paradise 下行}
```

**主线：Deadhorse Creek → Glacier Vista 往返**，约 2.8 英里、爬升约 150 米，中等强度 —— 上山正前方一路就是**尼斯阔利冰川**。

**午饭就是背上来的自热锅** —— Glacier Vista 找个背风处，对着冰川开饭，这顿的机位没有餐厅给得起。

回到 Paradise 再往东侧走 **Myrtle Falls**（往返 0.8 英里，铺装路）：瀑布 + 雷尼尔同框的明信片机位，正午前后的光线正好。

**九月末十月初高山灌木（越橘、花楸）秋色正在峰值**，红黄一片配冰川。

### Narada Falls

```trip-event
time: 12:15–12:35
category: viewpoint
place: Narada Falls
notes:
  - 停车场下到观景点约 0.2 英里，台阶常年水雾打湿，走稳
to_next: {mode: drive, minutes: 5, label: 转上 Stevens Canyon Road}
```

168 英尺的路边大瀑布，十月水量仍在 —— 从停车场走两步就到，性价比极高的顺路一站。

### 倒影湖

```trip-event
time: 12:45–13:05
category: outdoor
place: 倒影湖
to_next: {mode: drive, minutes: 5}
```

无风时能拍到完整雪山倒影。

### Stevens Canyon Road 跑山

```trip-event
time: 13:10–14:20
category: viewpoint
place: Stevens Canyon Road
notes:
  - Grove of the Patriarchs 因吊桥损毁长期关闭，别绕过去
to_next: {mode: drive, label: 继续沿 123 号 / 410 公路北上}
```

工作日的 Stevens Canyon 几乎是包场跑山。顺路可停 Box Canyon。

### Tipsoo Lake 湖边小环线

```trip-event
time: 14:25–14:55
category: outdoor
place: Tipsoo Lake
to_next: {mode: drive, minutes: 100, km: 105, label: 410 出山向西北，经 Enumclaw 到 Kent}
```

东侧 Chinook Pass。**只走湖边约 0.5 英里，10 分钟拿到 90% 的景。**

🚫 **不去 Sunrise：** Sunrise Road 十月上旬随时季节性关闭，从 Tipsoo 往返 3 小时只换一个 Emmons Vista 眺望点，不值。到此掉头出山。

### 收官 · Kent 和牛烤肉

```trip-event
time: 16:45–18:00
category: food
place: Asadero Sinaloa
flags: [needs-booking]
booking: {status: required}
cost: 约 $90/人
notes:
  - 周五生意火，按 16:45 订位（周五营业 11:00–22:00 已核实）
  - 时间偏早不算亏 —— 早饭 7 点多吃的、午饭是 11 点多的自热锅，到这正好饿；吃完还有日落场
to_next: {mode: drive, minutes: 35, label: WA-167 转 410 到 Tehaleh, note: 天阴就跳过日落场，直接去 Southcenter 充电回城}
```

**Asadero Sinaloa 发源老店**（Kent, Central Ave）—— 顶级和牛烤肉配重口莎莎，给全程最长的一天收官。

备选：**Bai Tong**（当年为泰航机组开的泰餐，本地传奇）。

### Tehaleh 雪山日落

```trip-event
time: 18:35–19:05
category: viewpoint
place: Tehaleh Rainier View Point
flags: [optional]
to_next: {mode: drive, minutes: 50, label: 走 167 北上到 Southcenter}
```

**时间和天气都合适才去** —— 天边没云的话，18:50 日落把整座雷尼尔染成玫瑰金，昨天的白天版在这补成日落版。

天阴或人乏就跳过，从 Kent 直接去充电回城，19:10 就进酒店。

### Southcenter 超充

```trip-event
time: 19:55–20:20
category: logistics
place: Southcenter 超充
cost: 约 $25
notes:
  - "充到 90% 左右 —— 明天市区一天用不了多少，后天奥林匹克半岛要 250 英里，起点电量从这一次来"
to_next: {mode: drive, minutes: 25, label: I-5 北上市中心，停 SpotHero 地库}
```

250 kW 快充，山上一天掉的电 25 分钟补回来。旁边就是 Southcenter 商场，买杯饮料的时间正好。

### 入住 AC Hotel · 三晚不挪窝

```trip-event
time: "20:50"
category: hotel
place: AC Hotel
detail: AC Hotel
flags: [tentative, needs-booking]
booking: {status: required}
cost: SpotHero 地库过夜 $15–30/晚 × 3
notes:
  - 行李全部搬进房间，车里不留任何东西 —— 西雅图车内盗窃率很高
  - 车停 SpotHero 封闭安保地库，有 L2 充电位的优先 —— 明早还要开去派克市场
```

**接下来三晚不挪窝** —— 两个住宿点跑完全程，晚上回来永远是同一张床。

## Day 3 · 2026-10-03

```trip-day
theme: 派克市场、玻璃球与凯里公园日落
sunrise: "07:10"
sunset: "18:48"
from_stay: {mode: drive, minutes: 8, label: 地库取车去派克市场, note: 停市场自家地库（1531 Western Ave 入口）}
```

**十月第一个周六** —— 亚马逊玻璃球这趟唯一的开放日，不可移动。今天开车串场：市场 → 玻璃球 → 水上飞机 → （Seattle Center 可选）→ Kerry Park 日落 → Queen Anne 晚餐。

**⚠️ 与 Day 4 可互换：** 周五晚看半岛天气，飓风岭若是雨雾，就把奥林匹克挪到今天、市区挪到明天 —— **代价是玻璃球（只在周六开放）作废、水上飞机和晚餐订位要改期**。决策点在周五晚，别拖到周六早上。

### 派克市场 · 泡一个上午

```trip-event
time: 10:15–12:45
category: food
place: 派克市场
cost: 市场地库停车约 $15–20
notes:
  - "Pike Place Chowder 11:00 开门 —— 10:50 就去排，这家是排队王者。点 Chowder Sampler：4 小杯一次尝 4 种口味"
to_next: {mode: drive, minutes: 6, label: 出地库停进玻璃球访客车库（2021 7th Ave）}
```

上午和午餐全交给市场，不赶场：**飞鱼秀**（正是热闹时段）、Post Alley、口香糖墙、第一家星巴克（队极长，拍照就走）、Down Under 那几层老铺子。

**先垫肚子**：**Piroshky Piroshky** 俄式馅饼 + **Le Panier** 可颂 + **Beecher's** 手工芝士通心粉现场看制作。

**午餐主角是 Pike Place Chowder** —— 4 小杯的 Sampler 一次把招牌口味尝遍，配市场里随手买的加餐，就地解决。

### 亚马逊玻璃球

```trip-event
time: 13:00–14:15
category: sight
place: 亚马逊玻璃球
flags: [needs-booking]
booking: {status: required}
cost: 访客车库 2021 7th Ave 约 $15
notes:
  - "预约窗口：9/18 上午 10 点开放、10/2 中午 12 点截止 —— 免费但即抢即空，9/18 定好闹钟，订 13:00 场"
to_next: {mode: drive, minutes: 10, label: 北上联合湖码头, note: 码头有收费停车场}
```

**这趟唯一的开放日**（每月仅第一、三个周六对公众开放），凭预约进入。玻璃穹顶内的热带雨林，1 小时够。

### 水上飞机天际线之旅

```trip-event
time: 15:00–16:00
category: experience
place: Kenmore Air 联合湖码头
flags: [needs-booking]
booking: {status: required}
cost: $159 × 2 = $318
notes:
  - 订 15:00 前后的场次，订时问清取消改期政策
  - 下午热对流比上午明显，会颠一点 —— 非嗜睡型晕车药 + 姜糖，起飞前 30 分钟吃
  - "被取消没有当天备份 —— 唯一的补救是和 Day 4 整体互换（见上）"
  - 市中心上空有空域限制，不会绕着太空针塔盘旋，是从侧上方远观
to_next: {mode: drive, minutes: 8, label: 去 Seattle Center 停车场, note: 不去 Seattle Center 就直接开去 Kerry Park，早到占位}
```

水面滑行起飞，上帝视角俯瞰市中心和整片湖区。Classic Seattle Tour 只飞 20 分钟左右，就算颠也很短。

### Seattle Center

```trip-event
time: 16:20–17:05
category: sight
place: Seattle Center
flags: [optional]
cost: Seattle Center 停车场约 $15
notes:
  - 不建议登太空针塔：$40+/人，刚从更高处飞过整个市中心，一小时后 Kerry Park 的构图更好
to_next: {mode: walk, minutes: 3, label: 走到单轨站}
```

太空针脚下、International Fountain、MoPOP 那栋金属扭曲建筑的外观。可去可不去 —— 累了就直接去 Kerry Park 占位。

### 单轨穿 MoPOP · 往返

```trip-event
time: 17:10–17:35
category: viewpoint
place: 单轨 Seattle Center 站
flags: [optional]
cost: 单轨往返约 $8/人
to_next: {mode: drive, minutes: 6, label: 取车去 Kerry Park, note: 山上路边位极少，早到 15 分钟绕圈}
```

**坐第一节车厢** —— 看列车直接穿过 MoPOP 建筑内部，到 Westlake 不下车原路坐回来。

### 凯里公园日落

```trip-event
time: 17:50–19:05
category: viewpoint
place: 凯里公园
to_next: {mode: drive, minutes: 5}
```

**今天的锚点。** 太空针 + 城市 + 远处雷尼尔一起变粉金 —— 昨天你们就在那座山顶下面。

**18:10–18:48 金光转粉紫，18:48–19:05 蓝调时刻更出片。**

### 晚餐 · Queen Anne

```trip-event
time: 19:20–21:00
category: food
place: How to Cook a Wolf
flags: [needs-booking]
booking: {status: required}
cost: 约 $80/人
notes:
  - 周六晚必须订位
to_next: {mode: drive, minutes: 12, label: 开回 AC Hotel 停地库}
```

**How to Cook a Wolf** —— Ethan Stowell 的意式小馆，小份多道，氛围浪漫。

备选：**Betty**（街区本地人首选，休闲一档，省 $60）· **Canlis**（全程只奢一次就选它，Queen Anne 北坡俯瞰联合湖，$150–200/人，提前几周订）。

### 回 AC Hotel

```trip-event
time: "21:15"
category: hotel
place: AC Hotel
detail: AC Hotel
notes:
  - 明早 06:45 出发赶 07:55 的渡轮 —— 今晚把明天的水、零食、外套放到车里
  - 电量低于 80% 的话，地库有 L2 就插上过夜；没有就明早在 Sequim 超充多充 10 分钟
```

## Day 4 · 2026-10-04

```trip-day
theme: 渡轮过海，奥林匹克半岛雨林与山脊
sunrise: "07:11"
sunset: "18:46"
from_stay: {mode: drive, minutes: 8, label: 市中心下到 Colman Dock 车道排队}
```

**全程最远的一天：往返约 250 英里 + 两趟渡轮，22:30 前后进酒店。** 车一直在手里，两次超充都顺路。

**⚠️ 天气决定这天：** 飓风岭在云里就什么都看不到。周五晚看预报，半岛周日不行就和 Day 3 互换（代价见 Day 3）。**出发前夜打 NPS 道路热线 (360) 565-3131**，看 Hurricane Ridge Road 是否开放、有无入园配额。

### 渡轮 · Colman Dock 排队上船

```trip-event
time: 07:20–07:55
category: ferry
place: Colman Dock 渡轮码头
cost: 车 + 司机 $19.20 × 2（往返各收）+ 乘客 $11.35（西向收一次）
notes:
  - "07:55 班（周日夏季时刻表；秋季表 9/20 起生效，出发前在 WSDOT 核一眼）—— 车道排队要提前 30 分钟到，没赶上 08:55 还有一班"
  - Seattle–Bainbridge 航线不接受预订，先到先上；周日早上西向车流稀
  - 刷卡有 3% 附加费，带张现金卡也行
to_next: {mode: ferry, minutes: 35, label: 车开上船，人上甲板看西雅图天际线缩小}
```

车开上船，人上顶层甲板 —— **背向西雅图看天际线整体缩小**，是这座城市最好的告别机位之一。船上有咖啡。

### 下船 · Bainbridge

```trip-event
time: 08:30–08:35
category: logistics
place: Bainbridge 渡轮码头
to_next: {mode: drive, minutes: 90, label: WA-305 → WA-3 → Hood Canal 浮桥 → US-101 到 Sequim，54 英里}
```

下船跟着车流出岛，一路是 Kitsap 半岛的林间公路和 Hood Canal 浮桥 —— 半岛的开场。

### Sequim 超充 · 早餐

```trip-event
time: 10:05–10:30
category: logistics
place: Sequim 超充
cost: 约 $20
notes:
  - "充到 90% 以上 —— 后面飓风岭 5,200 英尺爬升 + 新月湖来回，到晚上回到这里前没有别的超充"
to_next: {mode: drive, minutes: 10, label: 北上 Ward Rd 到动物农场}
```

Holiday Inn Express 停车场里的 8 桩 150 kW，隔壁买咖啡当早餐。

### Olympic Game Farm · 车窗喂动物

```trip-event
time: 10:40–11:40
category: experience
place: Olympic Game Farm
flags: [optional]
cost: $25/人 + 面包 $5/条
notes:
  - 秋季 09:00–16:00，全封闭车辆才能进 —— 只能开侧窗，人全程不下车
  - 面包在售票处买，别自带；牦牛和野牛会把整个头伸进车窗，特斯拉的窗别开太大
to_next: {mode: drive, minutes: 70, label: 回 101 西行，穿过 Port Angeles 到新月湖，37 英里}
```

开着车在草场里被野牛、驼鹿、熊（隔栏）围观，一小时的驾车游园。**她对自然感兴趣，这是全程最近距离的动物互动**。时间紧就跳过。

### 新月湖 · Lake Crescent Lodge 午餐

```trip-event
time: 12:50–13:45
category: food
place: Lake Crescent Lodge
cost: 约 $25/人
notes:
  - 餐厅 Singer's Table 供午餐（旅馆开到 12 月），坐落地窗那侧看湖
to_next: {mode: drive, minutes: 3, label: 湖边路开到 Storm King 停车场}
```

1915 年的湖边木屋旅馆，罗斯福 1937 年在这决定了建立奥林匹克国家公园。**新月湖是冰川湖，蓝得不像温带的湖。**

### Marymere Falls · 温带雨林步道

```trip-event
time: 13:50–15:00
category: outdoor
place: Marymere Falls 步道口
cost: 奥林匹克门票 $30/车（7 天有效）
notes:
  - 往返 1.8 英里、爬升约 300 英尺，平缓好走 —— 最后到瀑布观景台有一段木台阶
  - Storm King 护林站季节性关闭，步道照常；停车场就在 101 边上
to_next: {mode: drive, minutes: 70, label: 101 东行 30 分钟回 Port Angeles，再上 Hurricane Ridge Road 18 英里盘山约 40 分钟, note: 这段 ORS 路网没有，地图上画虚线是正常的}
```

穿过 101 下面的隧道进林子：**几百年的道格拉斯冷杉、西部红雪松、挂满苔藓的枫树**，脚下是蕨类和倒木 —— 温带雨林的教科书剖面，雨天反而更好看。90 英尺的 Marymere Falls 落在尽头。

变体：还有劲的话，Storm King 停车场对面的 **Moments in Time** 湖畔环线（0.6 英里，平地）再走 20 分钟。

### 飓风岭

```trip-event
time: 16:10–17:30
category: viewpoint
place: 飓风岭
flags: [warning]
notes:
  - "山顶 5,242 英尺，比山下低 10°C 以上、风大 —— 防风外套、帽子；十月可能已有初雪"
  - 游客中心 2023 年烧毁，山顶只有移动厕所和临时设施，可能按厕所容量限流 —— 下午上山人少，通常没事
  - 天阴到云底低于山脊就别上，40 分钟盘山只换一团白 —— 山下的 NPS 游客中心能看山顶实时摄像头
to_next: {mode: drive, minutes: 35, label: 下山回 Port Angeles 市中心}
```

正对 Bailey Range 群峰和奥林匹斯山的冰川，脚下是草甸和黑尾鹿。**下午的光线从西边打在群峰上，比中午立体。**

步道二选一：**Cirque Rim / High Ridge 小环线**（约 1 英里，铺装，30 分钟，景全拿到）—— 这是主线；**Hurricane Hill**（往返 3.2 英里、爬升 700 英尺，铺装，1.5 小时，山顶 360°）只有 16:00 前上到山顶、且跳过了 Game Farm 才够。

#### 变体 · 天好留到日落

18:46 日落时群峰变金红，是半岛最好的一张照片。**代价：晚餐推到 19:45 后，回程赶 21:45 或 22:30 的渡轮，23:00 后进酒店。** 周五晚决定。

### 晚餐 · Port Angeles

```trip-event
time: 18:05–19:00
category: food
place: Next Door Gastropub
cost: 约 $35/人
notes:
  - 周日晚不用订位，Port Angeles 的店 21:00 前后打烊，别拖到太晚
  - "19:00 出发是为了赶 21:45 的渡轮 —— 想吃慢点就跳过 Sequim 补电（电量 > 40% 就够回城），能多坐 20 分钟"
to_next: {mode: drive, minutes: 35, label: 101 东行回 Sequim，19 英里}
```

**Next Door Gastropub** —— 本地精酿 + 汉堡和海鲜，Port Angeles 市中心评价最稳的一家。

备选：**Kokopelli Grill**（203 E Front St，西南风味海鲜）。

### Sequim 超充 · 回程补电

```trip-event
time: 19:35–19:55
category: logistics
place: Sequim 超充
flags: [optional]
cost: 约 $15
notes:
  - "到 PA 时电量 > 40% 就不用停 —— 回城 54 英里 + 明早 Southcenter 补电前 20 英里足够；低于 40% 才补 15 分钟"
to_next: {mode: drive, minutes: 92, label: 101 → Hood Canal 浮桥 → WA-3 → WA-305 到 Bainbridge 码头，54 英里}
```

### 渡轮 · Bainbridge 排队上船

```trip-event
time: 21:30–21:45
category: ferry
place: Bainbridge 渡轮码头
notes:
  - "周日晚东向班次：20:55 / 21:45 / 22:30 / 00:00（夏季表，秋季表核一眼）—— 主线赶 21:45；跳过 Sequim 补电能赶 20:55；晚了 22:30 也稳"
to_next: {mode: ferry, minutes: 35, label: 甲板上看西雅图夜景整体放大 —— 这趟最后一个机位}
```

夜航进港：**整片市中心的灯从海面上迎面长出来**。

### 下船 · Colman Dock

```trip-event
time: 22:20–22:25
category: logistics
place: Colman Dock 渡轮码头
to_next: {mode: drive, minutes: 8, label: 开回 AC Hotel 停地库}
```

### 回 AC Hotel · 收拾行李

```trip-event
time: "22:35"
category: logistics
place: AC Hotel
flags: [warning]
notes:
  - 两个人的登机牌都在线办掉（DL 和 CX）
  - 行李今晚收完，明早不留任何决策
  - 闹钟 06:30，07:15 出发
```

倒推链从现在开始：**明早 07:15 出酒店 → 07:40 Southcenter 补电 → 08:25 前还完车 → 08:45 进航站楼。**

## Day 5 · 2026-10-05

```trip-day
theme: 清晨还车，各自起飞
sunrise: "07:13"
sunset: "18:44"
```

**清晨的 I-5 站在你们这边** —— 全程 25 分钟，不赌高峰。还车点在轻轨站，还完车坐一站 Link 就是机场。

### 退房出发

```trip-event
time: 07:00–07:15
category: logistics
place: AC Hotel
to_next: {mode: drive, minutes: 25, label: 清晨 I-5 空旷直奔 Southcenter}
```

前一晚都收好了，早上只做两件事：快速退房、从地库取车。

### Southcenter 超充 · 交车前补电

```trip-event
time: 07:40–08:00
category: logistics
place: Southcenter 超充
cost: 约 $15
notes:
  - 充到车主要求的还车电量（提车时问清的那个数），多充无益少充要赔
to_next: {mode: drive, minutes: 5, label: Strander Blvd 开到 Tukwila 轻轨站}
```

### 还车 · Tukwila 轻轨站

```trip-event
time: 08:05–08:25
category: drive
place: Tukwila 轻轨站
detail: Tesla Model Y
flags: [warning]
notes:
  - "08:25 前还完 —— 合同 09:00 截止，但再晚压缩的是她的国际航班缓冲"
  - 拍全车视频 / 清空车内 / 截图交车时的电量和里程
to_next: {mode: rail, minutes: 15, label: Link 南行一站 3 分钟到机场站，走天桥到航站楼约 10 分钟}
```

四天前在这提的车，闭环。

### 进航站楼

```trip-event
time: 08:45–09:00
category: logistics
place: SEA 机场
```

一起到、分头安检：我走 Delta 国内，她走 CX 国际区。**她 08:45 进去，国际线 3 小时缓冲正好；我不托运，直接安检。**

### 各自起飞

```trip-event
time: "10:10"
category: flight
place: SEA 机场
detail: 返程 · 各自起飞
```

我 10:10 先飞，13:11 落 SNA；她 11:45 起飞，经香港 **10/6 晚 22:10 落浦东**。

## 附录 · 出发前必办清单

```trip-ref
id: checklist
icon: ✅
```

### 现在就做

1. **AC Hotel Seattle Downtown 三晚（10/2–10/5）** —— 117 Yale Ave N，万豪系点数换划算；三晚一个订单别拆
2. **亚马逊玻璃球 10/3 预约 —— 9/18（周五）上午 10:00 开抢，定好闹钟** —— 免费但即抢即空，窗口到 10/2 中午 12:00 截止；订 13:00 场
3. **水上飞机 10/3 · 订 15:00 前后场** —— Kenmore Air（950 Westlake Ave N，开车 10 分钟，码头有收费停车）。问清取消改期政策 —— 下午场被取消没有当天备份
4. **Turo 车主三件事** —— Tukwila 站交接的具体位置和联系方式 / 还车电量要求 / FSD 是否已在这辆车上开通

### 一周内

- **餐厅订位**：Asadero Prime（10/2 周五 16:45，生意火）、How to Cook a Wolf（10/3 周六晚）
- **WSF 秋季时刻表**（9/20 起生效）—— 核周日 Seattle → Bainbridge 早班（夏季表 07:55 / 08:55）和 Bainbridge → Seattle 晚班（21:45 / 22:30）
- **Olympic Game Farm 秋季时间** 360-683-4295 确认 09:00–16:00
- SpotHero 下载 + 预订 **10/2–10/4 三晚** AC Hotel 附近地库，**带 L2 充电位的优先**
- **买轻便冰爪（microspikes）+ 登山杖**、非嗜睡型晕车药、姜糖

### 出发前 3 天

- **收好 Airbnb 自助入住指引**（门锁密码、Wi-Fi、充电桩位置、垃圾规则），离线存一份 —— Ashford 信号不稳
- **NPS 雷尼尔步道与道路状况页** —— 两件事都要查：
  - 道路：Stevens Canyon Rd / Hwy 410 Chinook Pass 是否因早雪封闭
  - 步道：**Paradise 一带（Glacier Vista / Myrtle Falls 沿线）是否结冰积雪**
- 雷尼尔 2026 时段预约制是否已结束
- **查 10/1 月相** —— 满月的话 Ashford 星空基本没了
- 逐个确认餐厅营业状态（西雅图这几年关店率高）

### 周五晚（10/2）的决策点

- **看半岛周日天气**：飓风岭云底 / 降雨 → 决定 Day 3 / Day 4 是否互换（互换要作废玻璃球、改水上飞机和 HTCAW 订位）
- **打 NPS 道路热线 (360) 565-3131** —— Hurricane Ridge Road 开放状态、有无限流
- 看一眼 Sequim / Port Angeles 超充的实时可用桩数（车机地图上）

## 附录 · 市区住宿（三晚）

```trip-ref
id: lodging-city
icon: 🏨
```

**三晚全住 AC Hotel 是这版行程的支点** —— 不挪窝，晚上回来永远是同一张床。AC 是万豪旗下的欧风精选牌子，点数价通常比 Westin 一档酒店低，现金价也实惠。

**门店：AC Hotel Seattle Downtown，117 Yale Ave N**（South Lake Union / Denny Triangle）—— 步行 8 分钟到 Kenmore Air 码头、10 分钟到玻璃球，开车 8–10 分钟到派克市场和 Colman Dock，位置正好卡在 Day 3/4 的动线上。

**订的时候盯两件事：**

1. 三晚一个订单别拆 —— 拆单可能被要求中途换房
2. 问清停车方案：酒店代客还是自停，附近地库有没有 L2 充电位

**停车地库带 L2 充电位是加分项** —— 三晚过夜慢充，Day 4 出发就是满电，Sequim 那次早餐补电可以省掉。

**AC 满房再看备选（同万豪系）：**

| 备选 | 位置 | 备注 |
| :-- | :-- | :-- |
| **Moxy Seattle Downtown** | SLU 边缘 | 年轻牌子，点数同档 |
| **Courtyard Downtown/Pioneer Square** | 老城 | 点数便宜，离 Colman Dock 最近 |
| **The Westin Seattle** | Westlake 旁 | 贵一档，位置最正 |

## 附录 · 租车 · 充电 · 停车

```trip-ref
id: car
icon: 🚗
```

**已订：Turo · Tesla Model Y Long Range（带 FSD）· 10/1 10:30 → 10/5 09:00 · $343.60 · 里程上限 2,000 英里 · 不可退。**

**交接在 Tukwila International Boulevard 轻轨站**（3651 Southcenter Blvd）—— 机场 Link 北行一站 3 分钟，到达层走到车站约 10 分钟，往返都不用打车。

**里程：** 全程约 520 英里（Day 1 约 115 · Day 2 约 220 · Day 3 约 30 · Day 4 约 250 · Day 5 约 20），2,000 上限用不到三成，不用惦记。

**充电策略（Model Y LR 标称 330 英里，按 260–280 实际算，山路和低温再打折）：**

| 时点 | 在哪充 | 目标 | 为什么 |
| :-- | :-- | :-- | :-- |
| Day 1 提车后 | 电量 < 60% 才去 **Southcenter 超充**（大华对面 3 分钟） | 到木屋够用 | Ashford 之前没有别的桩 |
| Day 1 夜 | **木屋免费特斯拉桩**（过夜） | 100% | 明天 220 英里 + 5,400 英尺爬升 |
| Day 2 回城前 | **Southcenter 超充**（Kent 烤肉 → 市区路上） | 90% | 市区两晚不一定有桩，Day 4 起点电量靠这次 |
| Day 3 夜 | 酒店地库 L2（有则插） | 补满 | 没有就跳过，明早 Sequim 多充 10 分钟 |
| Day 4 早 | **Sequim 超充**（Holiday Inn Express，早餐时） | ≥ 90% | 飓风岭爬升 + 新月湖往返，到晚上回 Sequim 前没有超充 |
| Day 4 晚 | **Sequim 超充**（晚餐后回程路上，可选） | 补到 60% | 到 PA 时电量 > 40% 就跳过 —— 回城 54 英里 + 明早去 Southcenter 20 英里够用 |
| Day 5 早 | **Southcenter 超充**（交车点 5 分钟） | 车主要求的还车电量 | 少充要赔、多充白送 |

Port Angeles 市区没有确认在营的超充（只有酒店的目的地慢充），所以半岛的两次补电都落在 Sequim —— 正好一次是早餐、一次是晚餐后。

**停车：**

| 时间 | 地点 | 费用 |
| :-- | :-- | :-- |
| 10/1 夜 | Mt. Rainier Getaway 门口（含充电） | 含 |
| 10/2–10/4 三夜 | AC Hotel 附近封闭地库（SpotHero，优先带 L2） | $15–30/晚 |
| 10/3 白天 | 派克市场地库 → 玻璃球访客车库 2021 7th Ave → 码头收费场 → Seattle Center 停车场 → Kerry Park 路边 | $15–20 · $15 · $10–15 · $15 · 免费 |
| 10/4 | 车在渡轮上和半岛各停车场，全部免费（国家公园门票 $30 含停车） | $0 |

## 附录 · 日期运气与风险

```trip-ref
id: risks
icon: 📅
```

**运气：**

- 10/3 是十月**第一个周六** → 亚马逊玻璃球开放（**这趟唯一的开放日，不可移动**）
- **10/2 周五进雷尼尔** —— 停车、步道、机位都比周末松
- 10/1–10/2 高山秋色正在峰值窗口；10/4 飓风岭草甸的秋色和初雪可能同框
- 十月是渡轮淡季：车票 $19.20 而非旺季 $25.90，周日早上西向不排长队

**风险：**

- **飓风岭天气**是 Day 4 的全部 —— 周五晚决策是否与 Day 3 互换；互换的代价是玻璃球作废、两处订位改期
- 飓风岭山顶设施烧毁后可能按厕所容量限流，道路也有秋季施工窗口 —— 前夜打 (360) 565-3131
- Seattle–Bainbridge 不接受预订：错过 07:55 就是 08:55，全天后推一小时（Game Farm 会被挤掉）
- 她的国际航班晚点会整体压缩 Day 1 —— 木屋是自助入住，晚到无碍；Tehaleh 和 Longmire 两个可选项就是当天的缓冲带
- 十月初雨季过渡，约五成概率遇雨
- Paradise 高处步道可能已有霜雪 —— 冰爪备着
- 十月初西雅图水手队可能在季后赛，市区酒店和交通会有临时溢价

**日落时间：** 10/1 18:52 · 10/2 18:50 · 10/3 18:48 · 10/4 18:46 · 10/5 18:44

## 附录 · 雨天预案

```trip-ref
id: rain
icon: 🌧️
```

**如果 10/2 雷尼尔被云雾封死**，别硬上 Glacier Vista 看白墙。改走低海拔雨林线：

- **Christine Falls + Narada Falls** —— 路边瀑布，雨天水量更大更美（Narada 本来就在主线里，雨天反而加分）
- **Longmire 历史区 + Trail of the Shadows** —— 0.7 英里环线，古木苔藓，雨中氛围极佳（Day 1 没去成的话正好补上）
- **Carbon River 雨林** —— 西北门，温带雨林，全程平坦

然后提早回城，把多出来的时间给 Kent 的和牛和酒店泡澡。

**如果半岛周日下雨**：先考虑和 Day 3 互换；两天都不行的话，**砍飓风岭、保新月湖** —— Marymere 的雨林在雨里最好看，Lake Crescent Lodge 壁炉边吃午餐，Game Farm 照常（人在车里），提早回城。

**市区遇雨的室内备选：** MoPOP（Seattle Center 内）· Seattle Aquarium（海滨 Ocean Pavilion）· Chihuly Garden and Glass（Seattle Center 内，玻璃艺术 + 温室）· Elliott Bay Book Company（Capitol Hill 的木结构独立书店）· 派克市场 Down Under（本来就在 Day 3，全在室内）

## 附录 · 预算

```trip-ref
id: budget
icon: 💰
```

双人，不含机票。逐项金额看上方的自动统计，这里只放数字之外的判断。

**机票已出票（不进下方统计）：** 我 SNA↔SEA 往返 $226.80（确认号 F9PJ3C，不含托运）；她 PVG↔SEA 两张单程共 $1,662.93，实付 46,185 点 + $1,201.08（各含 1 件托运）。

**💡 已锁定的大项：木屋 $339.42 + 租车 $343.60。** AC 三晚目标走点数，现金再出三晚停车。统计里没出现的隐性支出：**充电约 $80**（四次超充，替代了油费）、餐饮日均 $130–160、冰爪 + 登山杖一次性装备 $60–100。

**两个国家公园各 $30/车：** America the Beautiful 年票 $80 只有再去第三个公园才划算，这趟不值。

**想再压 $100+，按顺序砍：**

1. 跳过 Game Farm → 省 $55
2. 跳过单轨往返和 Seattle Center 停车 → 省 $31
3. Day 3 晚餐选 Betty 而非 How to Cook a Wolf → 省 $60

**⚠️ 最大变量：** 水手队若进季后赛，市区酒店现金价临时跳涨 —— AC 用点数订提前锁掉这个敞口，这也是清单第 1 条优先级的由来。

## 附录 · 打包清单

```trip-ref
id: packing
icon: 🎒
```

**山上专用**

- **轻便冰爪（microspikes）+ 登山杖** —— Paradise 高处步道十月清晨可能结霜结冰
- **抓地好的徒步鞋**
- **防水防风外套**（不是伞，雷尼尔和飓风岭山顶都有风）
- 太阳镜（雪面反光强）+ 防晒

**分层保暖** —— 市区白天 13–18°C，Paradise 早上 0–3°C，飓风岭下午 5–8°C 有风，Ashford 木屋夜里 4–7°C

**其他**

- **非嗜睡型晕车药 + 姜糖** —— Day 3 下午水上飞机前 30 分钟；渡轮不用
- **泳衣 + 拖鞋** —— 木屋若带泡池/浴缸就用得上，出发前看一眼房源设施清单
- 保温杯 / 车载充电器 / 移动电源
- ORCA 卡，或手机 Apple Pay 直接刷闸机（Link、单轨都能刷；渡轮车道是刷卡窗口）
- **Global Entry 卡（如果有）** —— Day 1 她出关能省 30 分钟
