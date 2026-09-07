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
  note: 我 10:05 先落地，直接去提车，提完开回航站楼接她。她过海关取行李约 11:45–12:15 出来，有 Global Entry 约 11:30
- kind: deadline
  at: 2026-10-05 08:15
  label: 必须还完车
  note: 倒推链 08:30 进航站楼 ← 08:15 还完车 ← 07:50 机场加完油 ← 07:15 出酒店
- kind: depart
  at: 2026-10-05 10:10
  label: 我起飞 · DL 1001
  note: 国内线，08:30 进航站楼绰绰有余
- kind: depart
  at: 2026-10-05 11:45
  label: 她起飞 · CX 853
  note: 国际航班，08:45 前进航站楼。和我一起到机场，分头安检
```

## 长途

```trip-transports
- what: 去程 · 汇合
  transport:
    - {traveler: 她, mode: flight, carrier: 大韩航空, from: PVG, to: SEA, dep_time: "11:10", arr_time: "10:40", arr_date: 2026-10-01, duration: 14h30m, baggage: 1 件托运, refund: 出票 24 小时内可免费取消, price: "$713.33", stops: [{airport: ICN, arr_time: "14:20", dep_time: "16:40", leg: 2h10m, wait: 2h20m}], legs: [{number: KE 882, cabin: Economy Saver, seat: 48J}, {number: KE 41, cabin: Economy Saver, seat: 35J}]}
    - {traveler: 我, mode: flight, carrier: 达美, number: DL 3687, from: SNA, to: SEA, dep_time: "07:00", arr_time: "10:05", duration: 3h05m, cabin: Delta Main Basic, baggage: 不含托运, price: "往返 $226.80"}
- what: 返程 · 各自起飞
  transport:
    - {traveler: 我, mode: flight, carrier: 达美, number: DL 1001, from: SEA, to: SNA, dep_time: "10:10", arr_time: "13:11", duration: 3h01m, cabin: Delta Main Basic, baggage: 不含托运, note: 与去程同一张往返票，票价计在去程}
    - {traveler: 她, mode: flight, carrier: 国泰航空, from: SEA, to: PVG, dep_time: "11:45", arr_time: "22:10", arr_day_offset: 1, duration: 19h25m, baggage: 1 件托运, price: "$949.60", stops: [{airport: HKG, arr_date: 2026-10-06, arr_time: "16:45", dep_time: "19:20", leg: 14h0m, wait: 2h35m}], legs: [{number: CX 853, cabin: Economy Light}, {number: CX 362, cabin: Economy Light}], note: 与去程分开的两张单程票，改签互不影响}
```

## 住宿

```trip-stays
- what: Mt. Rainier Getaway
  platform: Airbnb
  from: "2026-10-01 18:30"
  to: "2026-10-02 07:15"
  cost: $339.42
  room: 独栋木屋 · 自助入住/退房
  parking: 含 · 门口
- what: AC Hotel
  platform: 万豪 · AC Hotels
  from: "2026-10-02 20:10"
  to: "2026-10-05 07:15"
  stars: 4
  parking: 不含 · 停 SpotHero 地库
```

## 租车

```trip-rentals
- what: 租车（待定）
  platform: Sixt / Turo 二选一
  from: "2026-10-01 10:45"
  to: "2026-10-05 08:15"
  cost: 4 天 $400–550 预估
  pickup: SEA 机场
  dropoff: SEA 机场
```

## 地点表

```trip-places
- name: SEA 机场
  en: Seattle-Tacoma International Airport
  coord: 47.4435, -122.2961
  category: flight
  note: 坐标取航站楼正门（International Blvd），不是机场几何中心 —— 自驾路线要能算
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
- name: Narada Falls
  en: Narada Falls Mount Rainier
  coord: 46.7750, -121.7459
  category: viewpoint
- name: Asadero Sinaloa
  en: Asadero Prime Kent WA
  coord: 47.3831, -122.2470
  category: food
  note: 实际店名 Asadero Prime，310 Washington Ave N, Kent
- name: AC Hotel
  en: AC Hotel by Marriott Seattle Downtown
  coord: 47.6076, -122.3340
  category: hotel
  tentative: true
  note: 具体门店订房后定，坐标先按市中心占位 —— 定了回填并重跑 enrich
- name: 派克市场
  en: Pike Place Market
  coord: 47.6097, -122.3422
  category: food
- name: 华盛顿公园植物园
  en: Washington Park Arboretum Seattle
  coord: 47.6377, -122.2946
  category: outdoor
- name: 苏扎罗图书馆
  en: Suzzallo Library University of Washington
  coord: 47.6558, -122.3080
  category: sight
- name: 煤气厂公园
  en: Gas Works Park Seattle
  coord: 47.6456, -122.3344
  category: outdoor
- name: 凯里公园
  en: Kerry Park Seattle
  coord: 47.6295, -122.3599
  category: viewpoint
- name: How to Cook a Wolf
  en: How to Cook a Wolf Queen Anne Seattle
  coord: 47.6387, -122.3567
  category: food
- name: Kenmore Air 联合湖码头
  en: Kenmore Air Lake Union Seaplane Terminal
  coord: 47.6280, -122.3395
  category: experience
- name: 亚马逊玻璃球
  en: Amazon Spheres Seattle
  coord: 47.6155, -122.3390
  category: sight
- name: Serious Pie
  en: Serious Pie Downtown Seattle
  coord: 47.6132, -122.3410
  category: food
  note: 2001 4th Ave，周六 11:30 开门，离玻璃球步行 5 分钟
- name: MoPOP
  en: Museum of Pop Culture Seattle
  coord: 47.6215, -122.3481
  category: sight
- name: Seattle Center
  en: Seattle Center
  coord: 47.6221, -122.3540
  category: sight
- name: 单轨 Seattle Center 站
  en: Seattle Center Monorail Station
  coord: 47.6212, -122.3495
  category: transit
- name: Waterfront Park / Pier 62
  en: Waterfront Park Pier 62 Seattle
  coord: 47.6086, -122.3435
  category: viewpoint
- name: Elliott's Oyster House
  en: Elliott's Oyster House Pier 56 Seattle
  coord: 47.6054, -122.3409
  category: food
  note: Pier 56，1201 Alaskan Way
```

## Day 1 · 2026-10-01

```trip-day
theme: 双城落地汇合，提车南下雪山脚
sunrise: "07:07"
sunset: "18:52"
```

时差日，也是搬运日。今天的主线只有一条：汇合、补给、进山 —— 木屋和早睡是给明天 7:15 出门存的本钱。

### 抵达 SEA · 我先落地

```trip-event
time: "10:05"
category: flight
place: SEA 机场
detail: 去程 · 汇合
to_next: {mode: walk, minutes: 15, label: 出来直奔租车, note: Sixt 走机场租车中心（摆渡车直达）；Turo 则约车主交车点}
```

我 10:05 落地，国内线没有海关，10:30 前就能出来 —— **不等她，直接去办租车**。

她 10:40 落地，开始过海关取行李，正好是我提车的窗口。

### 提车

```trip-event
time: 10:45–11:30
category: drive
place: SEA 机场
detail: 租车（待定）
flags: [tentative, warning]
notes:
  - "Sixt / Turo 二选一未定：Sixt 在机场租车中心，柜台手续标准；Turo 是车主交车，车型有性格 —— 定哪家都要确认可进国家公园和里程政策"
  - 拍全车视频存证 / 问清加什么油 / 贵重物品全塞后备箱
to_next: {mode: drive, minutes: 5, label: 开回航站楼，国际到达层外接客道等她}
```

一个人办手续最快。提完车开回航站楼，**卡着她出关的点在到达层外接**。

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

**Sharps RoastHouse** —— 机场跑道边的烟熏烤肉老店，落地第一餐直接进入美式节奏。

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
to_next: {mode: drive, minutes: 40, label: WA-167 经 Puyallup 转 410 往 Bonney Lake 方向}
```

Great Wall Mall 里的大华超市，自热锅、亚洲零食一站配齐。

### Tehaleh 雪山合影

```trip-event
time: 15:15–15:45
category: viewpoint
place: Tehaleh Rainier View Point
flags: [optional]
to_next: {mode: drive, minutes: 80, label: 走 Orting-Kapowsin / Eatonville 到 Ashford}
```

Bonney Lake 南边的观景台，零遮挡，巨大的雷尼尔怼在眼前 —— **全程最好的车 + 雪山合影机位**，顺路小绕。

累了就跳过直接南下，明天一整天都是雪山。

### Longmire 历史区

```trip-event
time: 17:15–18:00
category: outdoor
place: Longmire
flags: [optional]
cost: 雷尼尔门票 $30/车（7 天有效）
notes:
  - 来得及且精力允许才进 —— Nisqually 门再开 10 分钟就到
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
  - 山区夜里 4–7°C，厚外套 + 拖鞋
  - 睡前查一次 NPS 步道状况，Paradise 结冰就把冰爪备在包顶
  - 时差克星是早睡 —— 明早 07:15 出门
```

晚餐两条路：**木屋有灶台**，用大华买的食材简单做点；或者干脆路上解决 —— **Copper Creek Inn**（园门方向 7 分钟，黑莓派是招牌）约 20:00 打烊，来得及。

**自热锅别动** —— 那是明天中午山上的午饭。

## Day 2 · 2026-10-02

```trip-day
theme: 雷尼尔环线，夜宿回城
sunrise: "07:08"
sunset: "18:50"
```

**⚠️ 全程最长的一天：7:15 出门，20:10 进酒店（跳过日落场 19:00 就到）。**

**周五进山比周末松一大截** —— 停车、步道、机位都是。

**为什么是 Glacier Vista 这条线：** 中等强度就把最值钱的景拿全了 —— 上山正前方一路是**雷尼尔和尼斯阔利冰川**，回程加走 Myrtle Falls 拿明信片机位，出园顺路再收 Narada Falls。Panorama Point 以上的雪原、碎石和 430 米爬升整段让掉，膝盖和体力都留给后面三天。

### 出发 · 西南门

```trip-event
time: "07:15"
category: logistics
place: Mt. Rainier Getaway
to_next: {mode: drive, minutes: 60, km: 26, label: 木屋 → Nisqually 门约 10 分钟 → Paradise 约 50 分钟（18 英里盘山）}
```

清晨无车跑山，**08:15–08:30 到 Paradise 稳稳有位**（周五压力比周末小，这是双保险）。

早餐吃昨晚买的。想喝正经咖啡：Ashford 的 **Whittaker's** espresso 吧开得早。**行李全部装车、自助退房** —— 今晚直接回市区，不回木屋。

### Paradise · Glacier Vista + Myrtle Falls

```trip-event
time: 08:45–11:45
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

回到 Paradise 再往东侧走 **Myrtle Falls**（往返 0.8 英里，铺装路）：瀑布 + 雷尼尔同框的明信片机位，11 点多的光线正好。

**九月末十月初高山灌木（越橘、花楸）秋色正在峰值**，红黄一片配冰川。

### Narada Falls

```trip-event
time: 12:00–12:20
category: viewpoint
place: Narada Falls
notes:
  - 停车场下到观景点约 0.2 英里，台阶常年水雾打湿，走稳
to_next: {mode: drive, minutes: 5, label: 转上 Stevens Canyon Road}
```

168 英尺的路边大瀑布，十月水量仍在 —— 从停车场走两步就到，性价比极高的顺路一站。

### 倒影湖

```trip-event
time: 12:30–12:50
category: outdoor
place: 倒影湖
to_next: {mode: drive, minutes: 5}
```

无风时能拍到完整雪山倒影。

### Stevens Canyon Road 跑山

```trip-event
time: 12:55–14:05
category: viewpoint
place: Stevens Canyon Road
notes:
  - Grove of the Patriarchs 因吊桥损毁长期关闭，别绕过去
to_next: {mode: drive, label: 继续沿 123 号 / 410 公路北上}
```

工作日的 Stevens Canyon 几乎是包场跑山。顺路可停 Box Canyon。

### Tipsoo Lake 湖边小环线

```trip-event
time: 14:10–14:40
category: outdoor
place: Tipsoo Lake
to_next: {mode: drive, minutes: 100, km: 105, label: 410 出山向西北，经 Enumclaw 到 Kent, note: 途中把油加了，市区几天就不用惦记油箱}
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
  - 时间偏早不算亏 —— 早饭 6 点多吃的、午饭是 11 点的自热锅，到这正好饿；吃完还有日落场
to_next: {mode: drive, minutes: 35, label: WA-167 转 410 到 Tehaleh, note: 天阴就跳过日落场直接回城，55 分钟进酒店}
```

**Asadero Sinaloa 发源老店**（Kent, Central Ave）—— 顶级和牛烤肉配重口莎莎，给全程最长的一天收官。

备选：**Bai Tong**（当年为泰航机组开的泰餐，本地传奇）。

### Tehaleh 雪山日落

```trip-event
time: 18:35–19:05
category: viewpoint
place: Tehaleh Rainier View Point
flags: [optional]
to_next: {mode: drive, minutes: 55, label: 回城，I-5 北上市中心，停 SpotHero 地库}
```

**时间和天气都合适才去** —— 天边没云的话，18:50 日落把整座雷尼尔染成玫瑰金，昨天的白天版在这补成日落版。

天阴或人乏就跳过，从 Kent 直接回城，19:00 就进酒店。

### 入住 AC Hotel · 三晚不挪窝

```trip-event
time: "20:10"
category: hotel
place: AC Hotel
detail: AC Hotel
flags: [tentative, needs-booking]
booking: {status: required}
cost: SpotHero 地库过夜 $15–30/晚 × 3
notes:
  - 行李全部搬进房间，车里不留任何东西 —— 西雅图车内盗窃率很高
  - 车停 SpotHero 封闭安保地库，明早还要开去码头
```

**接下来三晚不挪窝** —— 两个住宿点跑完全程，晚上回来永远是同一张床。

## Day 3 · 2026-10-03

```trip-day
theme: 水上飞机、玻璃球与海滨日落
sunrise: "07:10"
sunset: "18:48"
from_stay: {mode: drive, minutes: 10, label: 地库取车，北上联合湖码头, note: 码头有收费停车场，停一上午}
```

**十月第一个周六** —— 亚马逊玻璃球这趟唯一的开放日，不可移动。今天开车串场：码头 → **玻璃球访客车库（2021 7th Ave，停到傍晚）** → Serious Pie 午餐 → 玻璃球 → Seattle Center 步行/单轨往返 → 取车去海滨看日落。

**为什么水上飞机放上午：** ① 上午气流稳，下午热对流明显更颠 ② 空腹或轻食上飞机比刚吃完午饭好 ③ **决定性理由 —— 上午被取消还有一整个下午当天补飞（12:30 / 13:30 场）；订下午被取消就彻底没了**。

### 水上飞机天际线之旅

```trip-event
time: 10:00–11:00
category: experience
place: Kenmore Air 联合湖码头
flags: [needs-booking]
booking: {status: required}
cost: $159 × 2 = $318
notes:
  - 订 10:00 场，订时问清取消改期政策
  - 十月早晨常有海雾低云，班次有取消风险 —— 被取消就顺延 12:30 / 13:30 场（见如果）
  - 市中心上空有空域限制，不会绕着太空针塔盘旋，是从侧上方远观
  - 非嗜睡型晕车药 + 姜糖，起飞前 30 分钟吃
to_next: {mode: drive, minutes: 8, label: 南下停进玻璃球访客车库（2021 7th Ave）}
```

水面滑行起飞，上帝视角俯瞰市中心和整片湖区。

#### 变体 · 海雾没散

顺延到 **12:30 / 13:30 场**：午餐压缩、MoPOP 直接砍，玻璃球的预约时段不动。Classic Seattle Tour 只飞 20 分钟左右，就算颠也很短。

### 午餐 · Serious Pie

```trip-event
time: 11:30–12:45
category: food
place: Serious Pie
cost: 约 $30/人
notes:
  - "车停 2021 7th Ave 访客车库（周六日间约 $15–25），一直放到傍晚 —— 2120 那个「用餐免费停」的口子周六 16:00 才开门，中午用不上"
to_next: {mode: walk, minutes: 5, label: 走到玻璃球}
```

Tom Douglas 的招牌薄底披萨，蛤蜊披萨是名场面 —— **11:30 开门，掐点进去不用排**。

备选：**Biscuit Bitch**（Belltown，重口美式早午餐）。

### 亚马逊玻璃球

```trip-event
time: 13:00–14:15
category: sight
place: 亚马逊玻璃球
flags: [needs-booking]
booking: {status: required}
notes:
  - "预约窗口：9/18 上午 10 点开放、10/2 中午 12 点截止 —— 免费但即抢即空，9/18 定好闹钟"
to_next: {mode: walk, minutes: 25, label: 步行去 Seattle Center, note: 不想走就去 Westlake 搭单轨，或 3rd Ave 搭 D Line，10 分钟}
```

**这趟唯一的开放日**（每月仅第一、三个周六对公众开放），凭预约进入。玻璃穹顶内的热带雨林，1 小时够。

### Seattle Center

```trip-event
time: 14:45–15:45
category: sight
place: Seattle Center
notes:
  - 不建议登太空针塔：$40+/人，今早刚从更高处飞过整个市中心，明晚还有 Kerry Park 的更好构图，十月云层还可能让塔顶什么都看不到
to_next: {mode: walk, minutes: 2, label: 就在场内}
```

太空针脚下、International Fountain、MoPOP 那栋金属扭曲建筑的外观。

### MoPOP

```trip-event
time: 15:50–17:00
category: sight
place: MoPOP
flags: [optional]
cost: 约 $35/人
to_next: {mode: walk, minutes: 3, label: 走到单轨站}
```

流行文化博物馆：Nirvana 与西雅图之声、吉他旋风塔、科幻与恐怖片道具馆 —— **也是今天最好的雨天保险**。不进去就在外面拍拍金属曲面，直接去单轨。

### 单轨穿 MoPOP

```trip-event
time: 17:10–17:25
category: viewpoint
place: 单轨 Seattle Center 站
to_next: {mode: drive, minutes: 20, label: Westlake 下车走 8 分钟回 Day 1 车库取车，开去海滨, note: 海滨停派克市场地库或 Pier 附近收费场，$15–25}
```

**坐第一节车厢** —— 看列车直接穿过 MoPOP 建筑内部，回 Westlake 正好取车。

### 海滨日落

```trip-event
time: 17:50–18:55
category: viewpoint
place: Waterfront Park / Pier 62
cost: Seattle Great Wheel 摩天轮 $18/人（可选）
to_next: {mode: walk, minutes: 8, label: 沿栈桥南行到 Pier 56}
```

走 **2024 年新开的 Overlook Walk** 下到海滨，**18:00 前占位** —— 太阳落进对岸的**奥林匹克山脉**（18:48）。

**Seattle Great Wheel** 摩天轮日落时段坐最值；时间富余就在栈桥来杯咖啡。

### 晚餐 · 海滨

```trip-event
time: 19:15–20:45
category: food
place: Elliott's Oyster House
flags: [needs-booking]
booking: {status: required}
notes:
  - 周六晚必须提前订位
cost: 约 $70/人
to_next: {mode: drive, minutes: 8, label: 取车开回 AC Hotel，停回地库}
```

**Elliott's Oyster House**（Pier 56）—— 生蚝质量最好。**浓汤别在这点** —— 明天中午派克市场的 Pike Place Chowder 有 4 杯装 Sampler 等着。

备选：**Ivar's Acres of Clams**（Pier 54，本地老字号，炸鱼薯条 + 浓汤）· **The Crab Pot**（Pier 57，砸蟹腿，体验强但出品一般，海滨在改造先确认）。

### 回 AC Hotel

```trip-event
time: "21:00"
category: hotel
place: AC Hotel
detail: AC Hotel
```

今天是全程最满的一天，明天睡到自然醒一点。

## Day 4 · 2026-10-04

```trip-day
theme: 派克市场到凯里公园日落
sunrise: "07:11"
sunset: "18:46"
from_stay: {mode: drive, minutes: 8, label: 地库取车去派克市场, note: 停市场自家地库（1531 Western Ave 入口）}
```

睡到自然醒，**10 点出发**。今天的锚点是 18:00 的 Kerry Park 日落，下午所有安排都为它让路。**落后了就按 煤气厂公园 → 苏扎罗图书馆 的顺序往下砍**（日本花园门票也可省）。今晚回来要收行李 —— 明早 07:15 出发。

### 派克市场 · 泡一个上午

```trip-event
time: 10:15–14:15
category: food
place: 派克市场
cost: 市场地库停车约 $15–20
notes:
  - "Pike Place Chowder 11:00 开门 —— 10:50 就去排，这家是排队王者。点 Chowder Sampler：4 小杯一次尝 4 种口味"
to_next: {mode: drive, minutes: 15, label: 出地库，Madison 向东去植物园}
```

整整四个小时全交给市场，不赶场：**飞鱼秀**（正是热闹时段）、Post Alley、口香糖墙、第一家星巴克（队极长，拍照就走）、Down Under 那几层老铺子。

**先垫肚子**：**Piroshky Piroshky** 俄式馅饼 + **Le Panier** 可颂 + **Beecher's** 手工芝士通心粉现场看制作。

**午餐主角是 Pike Place Chowder** —— 4 小杯的 Sampler 一次把招牌口味尝遍，配市场里随手买的加餐，就地解决。吃完再补一轮 Post Alley 消食。

### 华盛顿公园植物园

```trip-event
time: 14:30–15:30
category: outdoor
place: 华盛顿公园植物园
cost: 日本花园约 $10/人（可选）
to_next: {mode: drive, minutes: 10}
```

**"开车压马路"兑现的地方** —— Lake Washington Blvd 湖畔林荫路，出片靠车不靠枫叶。

**⚠️ 秋色预期：现在基本还是绿的。** 红枫峰值在十月下旬。

日本花园可选，多花 45 分钟。

### 苏扎罗图书馆

```trip-event
time: 15:40–16:20
category: sight
place: 苏扎罗图书馆
flags: [optional]
cost: Central Plaza Garage 停车约 $5
to_next: {mode: drive, minutes: 12}
```

霍格沃茨阅览室。**十月是 UW 秋季学期，校园很有生气** —— 但今天是周日，看的是建筑不是人气。

### 煤气厂公园

```trip-event
time: 16:35–17:35
category: outdoor
place: 煤气厂公园
flags: [optional]
to_next: {mode: drive, minutes: 20, note: 山上路边位极少，早到 15 分钟绕圈}
```

废土风工业遗迹，隔联合湖看天际线，和 Kerry Park 完全不同的调子。

### 凯里公园日落

```trip-event
time: 17:55–19:10
category: viewpoint
place: 凯里公园
to_next: {mode: drive, minutes: 5}
```

**今天的锚点。** 太空针 + 城市 + 远处雷尼尔一起变粉金 —— 前天你们就在那座山顶下面。

**18:10–18:45 金光转粉紫，18:45–19:10 蓝调时刻更出片。**

### 晚餐 · Queen Anne

```trip-event
time: 19:20–21:00
category: food
place: How to Cook a Wolf
flags: [needs-booking]
booking: {status: required}
cost: 约 $80/人
to_next: {mode: drive, minutes: 12, label: 开回 AC Hotel 停地库}
```

**How to Cook a Wolf** —— Ethan Stowell 的意式小馆，小份多道，氛围浪漫，收官晚餐。

备选：**Betty**（街区本地人首选，休闲一档，省 $60）· **Canlis**（全程只奢一次就选它，Queen Anne 北坡俯瞰联合湖，$150–200/人，提前几周订）。

### 收拾行李 · 早睡

```trip-event
time: "21:30"
category: logistics
place: AC Hotel
flags: [warning]
notes:
  - 两个人的登机牌都在线办掉（DL 和 CX）
  - 行李今晚收完，明早不留任何决策
  - 闹钟 06:30，07:15 出发
```

倒推链从现在开始：**明早 07:15 出酒店 → 08:15 前还完车 → 08:30/08:45 各自进航站楼。**

## Day 5 · 2026-10-05

```trip-day
theme: 清晨还车，各自起飞
sunrise: "07:13"
sunset: "18:44"
```

**清晨的 I-5 站在你们这边** —— 全程 25 分钟，不赌高峰，8 点左右还完车两个人都从容。

### 退房出发

```trip-event
time: 07:00–07:15
category: logistics
place: AC Hotel
to_next: {mode: drive, minutes: 25, label: 清晨 I-5 空旷，顺路加油 10 分钟, note: 还车要满箱，留好小票}
```

前一晚都收好了，早上只做两件事：快速退房、从地库取车。

### 还车

```trip-event
time: 07:55–08:15
category: drive
place: SEA 机场
detail: 租车（待定）
flags: [warning]
notes:
  - "08:15 前还完 —— 再晚压缩的是她的国际航班缓冲"
  - 拍全车视频 / 清空车内 / 保留加油小票
to_next: {mode: walk, minutes: 15, label: 租车中心摆渡或车主送到航站楼, note: 具体方式定了哪家再确认}
```

四天前在这提的车，闭环。

### 进航站楼

```trip-event
time: 08:30–08:45
category: logistics
place: SEA 机场
```

一起到、分头安检：我走 Delta 国内，她走 CX 国际区。**她 08:45 进去，国际线 3 小时缓冲正好。**

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

1. **定租车（最急）** —— Sixt / Turo 二选一：SEA 机场提还，10/1 10:45 → 10/5 08:15，4 天。哪家都要确认：可进国家公园 / 里程政策 / 机场交接车方式
2. **AC Hotel 三晚（10/2–10/5）** —— 万豪系 AC Hotels，点数换划算；选市中心门店，订好后把地址坐标回填地点表
3. **亚马逊玻璃球 10/3 预约 —— 9/18（周五）上午 10:00 开抢，定好闹钟** —— 免费但即抢即空，窗口到 10/2 中午 12:00 截止；订 13:00 前后的时段
4. **水上飞机 10/3 · 订 10:00 场** —— Kenmore Air（950 Westlake Ave N，开车 10 分钟，码头有收费停车）。问清取消改期政策

### 一周内

- **餐厅订位**：Asadero Prime（10/2 周五 16:45，生意火）、Elliott's（10/3 周六晚，必须订）、How to Cook a Wolf（10/4 周日晚）
- SpotHero 下载 + 预订 **10/2–10/4 三晚** AC Hotel 附近地库
- **买轻便冰爪（microspikes）+ 登山杖**、非嗜睡型晕车药、姜糖

### 出发前 3 天

- **收好 Airbnb 自助入住指引**（门锁密码、Wi-Fi、垃圾规则），离线存一份 —— Ashford 信号不稳
- **NPS 雷尼尔步道与道路状况页** —— 两件事都要查：
  - 道路：Stevens Canyon Rd / Hwy 410 Chinook Pass 是否因早雪封闭
  - 步道：**Paradise 一带（Glacier Vista / Myrtle Falls 沿线）是否结冰积雪**
- 雷尼尔 2026 时段预约制是否已结束
- **查 10/1 月相** —— 满月的话 Ashford 星空基本没了
- 逐个确认餐厅营业状态（西雅图这几年关店率高）

## 附录 · 市区住宿（三晚）

```trip-ref
id: lodging-city
icon: 🏨
```

**三晚全住 AC Hotel 是这版行程的支点** —— 不挪窝，晚上回来永远是同一张床。AC 是万豪旗下的欧风精选牌子，点数价通常比 Westin 一档酒店低，现金价也实惠。

**订的时候盯三件事：**

1. **选市中心门店**（Westlake 商圈半径内最好）—— Day 3 电车去水上飞机、Day 4 步行去派克市场都指着这个位置
2. 订好后**把地址和坐标回填地点表**（现在是市中心占位坐标），重跑一次 enrich
3. 三晚一个订单别拆 —— 拆单可能被要求中途换房

**AC 满房再看备选（同万豪系）：**

| 备选 | 位置 | 备注 |
| :-- | :-- | :-- |
| **Moxy Seattle Downtown** | SLU 边缘 | 年轻牌子，点数同档 |
| **Courtyard Downtown/Pioneer Square** | 老城 | 点数便宜 |
| **The Westin Seattle** | Westlake 旁 | 贵一档，位置最正 |

## 附录 · 租车与停车

```trip-ref
id: car
icon: 🚗
```

**租期：4 天，10/1 10:45 SEA 机场提 → 10/5 08:15 SEA 机场还。**

**Sixt vs Turo 怎么选：**

| | Sixt | Turo |
| :-- | :-- | :-- |
| 交接 | 机场租车中心，摆渡车直达，柜台手续 | 车主交车，点位和时间要提前约 |
| 车型 | 标准车队，看运气升舱 | 挑得到有性格的车 |
| 要确认 | 跨州/国家公园无限制，里程政策 | **可否进国家公园 + 里程上限**，逐单不同 |

**⚠️ 哪家都要过的三关：** 可进国家公园 / 里程政策（全程约 310 英里）/ 机场交接车的具体方式。

**用车节奏：** Day 1–2 重度（机场→Ashford→雷尼尔→市区），Day 3–4 市区串场，Day 5 清晨送机场。

**停车策略：**

| 时间 | 地点 | 费用 |
| :-- | :-- | :-- |
| 10/1 夜 | Mt. Rainier Getaway 门口 | 含 |
| 10/2–10/4 三夜 | AC Hotel 附近封闭地库（SpotHero） | $15–30/晚 |
| 10/3 白天 | 码头收费场（上午）→ 玻璃球访客车库 2021 7th Ave（午后）→ 海滨地库（傍晚） | $10–20 + $15–25 + $15–25 |
| 10/4 白天 | 派克市场地库（上午）· Central Plaza Garage（华大，可选站） | $15–20 · $5–10 |

## 附录 · 日期运气与风险

```trip-ref
id: risks
icon: 📅
```

**运气：**

- 10/3 是十月**第一个周六** → 亚马逊玻璃球开放（**这趟唯一的开放日，不可移动**）
- **10/2 周五进雷尼尔** —— 停车、步道、机位都比周末松
- 10/1–10/2 高山秋色正在峰值窗口，雷尼尔夏季时段预约制通常已结束

**风险：**

- 她的国际航班晚点会整体压缩 Day 1 —— 木屋是自助入住，晚到无碍；Tehaleh 和 Longmire 两个可选项就是当天的缓冲带
- 十月初雨季过渡，约五成概率遇雨
- Paradise 高处步道可能已有霜雪 —— 冰爪备着
- **市区秋色还没上色**，植物园红枫峰值在十月下旬
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

**市区遇雨的室内备选：** MoPOP（Day 3 的可选项，雨天直接转正）· Seattle Aquarium（海滨 Ocean Pavilion）· Chihuly Garden and Glass（Seattle Center 内，玻璃艺术 + 温室）· Elliott Bay Book Company（Capitol Hill 的木结构独立书店）· 派克市场 Down Under（本来就在 Day 4，全在室内）

## 附录 · 预算

```trip-ref
id: budget
icon: 💰
```

双人，不含机票。逐项金额看上方的自动统计，这里只放数字之外的判断。

**机票已出票（不进下方统计）：** 我 SNA↔SEA 往返 $226.80（确认号 F9PJ3C，不含托运）；她 PVG↔SEA 两张单程共 $1,662.93，实付 46,185 点 + $1,201.08（各含 1 件托运）。

**💡 住宿口径：木屋 $339.42 已锁定，AC 三晚目标走点数，现金再出三晚停车。** 统计里没出现的隐性支出：油费约 $85（约 310 英里）、餐饮日均 $130–160、冰爪 + 登山杖一次性装备 $60–100。

**想再压 $100+，按顺序砍：**

1. 跳过摩天轮和日本花园 → 省 $56
2. Day 4 晚餐选 Betty 而非 How to Cook a Wolf → 省 $60

**⚠️ 最大变量：** 水手队若进季后赛，市区酒店现金价临时跳涨 —— AC 用点数订提前锁掉这个敞口，这也是清单第 2 条优先级的由来。

## 附录 · 打包清单

```trip-ref
id: packing
icon: 🎒
```

**山上专用**

- **轻便冰爪（microspikes）+ 登山杖** —— Paradise 高处步道十月清晨可能结霜结冰
- **抓地好的徒步鞋**
- **防水外套**（不是伞，山上有风）
- 太阳镜（雪面反光强）+ 防晒

**分层保暖** —— 市区白天 13–18°C，Paradise 早上 0–3°C，Ashford 木屋夜里 4–7°C

**其他**

- **非嗜睡型晕车药 + 姜糖** —— Day 3 早上水上飞机前 30 分钟
- **泳衣 + 拖鞋** —— 木屋若带泡池/浴缸就用得上，出发前看一眼房源设施清单
- 保温杯 / 车载充电器 / 移动电源
- ORCA 卡，或手机 Apple Pay 直接刷闸机（电车、单轨都能刷）
- **Global Entry 卡（如果有）** —— Day 1 她出关能省 30 分钟
