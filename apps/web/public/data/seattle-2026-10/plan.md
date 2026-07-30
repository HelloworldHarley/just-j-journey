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
- kind: flight-arrive
  at: 2026-10-01 13:11
  label: 抵达 SEA · 国际航班
  note: 过海关 + 走到轻轨 + 车程 → 到 Astra 约 16:00–16:30。有 Global Entry 约 14:15 出关，否则 14:45–15:00
- kind: deadline
  at: 2026-10-02 11:20
  label: 租车计费节点
  note: 早于 11:20 提车跳 4 天计费，晚于它算 3 天。所以约 11:30 提车
- kind: deadline
  at: 2026-10-05 11:20
  label: 必须还车
  note: 倒推链 12:40 到航站楼 ← 12:25 SEA 轻轨站 ← 11:45 Chinatown-ID 上车 ← 11:20 还车
- kind: flight-depart
  at: 2026-10-05 15:40
  label: 离开 SEA · 国际航班
  note: 12:40 前到航站楼。绝对底线 13:10，但别拿这个当计划
```

## 地点表

```trip-places
- name: SEA 机场
  en: Seattle-Tacoma International Airport
  coord: 47.4502, -122.3088
  category: flight
- name: Astra Hotel
  en: Astra Hotel Seattle, Autograph Collection
  category: lodging
  note: 300 Terry Ave N，South Lake Union。50K 券 + 补 5,000 点
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
  category: food
- name: 派克市场
  en: Pike Place Market
  coord: 47.6097, -122.3422
  category: food
- name: 唐人街提车点
  en: Chinatown International District Seattle
  coord: 47.5983, -122.3277
  category: logistics
- name: Capitol Hill
  en: Capitol Hill Seattle
  coord: 47.6205, -122.3212
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
  category: food
- name: Altitude Sky Lounge
  en: Altitude Sky Lounge Seattle
  category: bar
  note: Astra 顶层屋顶酒吧
- name: Kenmore Air 联合湖码头
  en: Kenmore Air Lake Union Seaplane Terminal
  coord: 47.6280, -122.3395
  category: experience
- name: 亚马逊玻璃球
  en: Amazon Spheres Seattle
  coord: 47.6155, -122.3390
  category: sight
- name: Chihuly Garden and Glass
  en: Chihuly Garden and Glass Seattle
  coord: 47.6205, -122.3505
  category: sight
- name: Bonney Lake 补货点
  en: Fred Meyer Bonney Lake WA
  category: logistics
- name: Tehaleh Rainier View Point
  en: Tehaleh Rainier View Point Bonney Lake WA
  category: viewpoint
  note: 坐标待现场核对，Nominatim 查不到
- name: Ashford 木屋
  en: Ashford WA
  coord: 46.7570, -122.0270
  category: lodging
  tentative: true
  note: 5 选 1 未定，见附录
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
- name: Crystal Mountain 缆车
  en: Crystal Mountain Gondola WA
  coord: 46.9350, -121.4750
  category: experience
  tentative: true
  note: 十月上旬是否运营需出发前确认
- name: Asadero Sinaloa
  en: Asadero Sinaloa Kent WA
  category: food
- name: Renaissance Seattle
  en: Renaissance Seattle Hotel
  coord: 47.6072, -122.3300
  category: lodging
  tentative: true
  note: 换不出来退 Courtyard Pioneer Square
- name: Jade Garden
  en: Jade Garden Restaurant Seattle Chinatown
  coord: 47.5977, -122.3235
  category: food
- name: Chinatown-ID 轻轨站
  en: Chinatown International District Station Seattle
  coord: 47.5983, -122.3277
  category: transit
```

## Day 1 · 2026-10-01

```trip-day
theme: Seattle Center → 单轨穿 MoPOP → 海滨日落
sunset: "18:52"
lodging: Astra Hotel
```

时差日。主线是把行李安顿好，靠日落收尾，别排太满。

### 航班抵达

```trip-event
time: "13:11"
category: flight
place: SEA 机场
flags: [warning]
flight: {to: SEA, arr_time: "13:11", note: 国际到达，出关后行李转盘取行李}
to_next: {mode: rail, minutes: 38, label: 1 Line 到 Westlake，再换电车, note: 行李转盘走到轻轨站还要 12 分钟}
```

**有 Global Entry 约 14:15 出关，否则 14:45–15:00。**

到 Westlake Station 后换 **South Lake Union Streetcar**，在 **Terry & Thomas 站**下车，Astra 就在眼前。

### 放行李 · 入住 Astra

```trip-event
time: 16:00–16:30
category: lodging
place: Astra Hotel
to_next: {mode: walk, minutes: 22, km: 1.8, label: 平路好走}
```

50K 券 + 补 5,000 点换的房。**万豪允许给免房券最多加 15,000 点**，两晚共补 10,000 点。

### Seattle Center

```trip-event
time: 16:55–17:50
category: sight
place: Seattle Center
to_next: {mode: monorail, minutes: 5, label: 单轨列车穿 MoPOP → Westlake Center, note: 约 $4，ORCA 可刷}
```

太空针脚下、International Fountain、MoPOP 那栋金属扭曲建筑的外观。

**🚫 不建议登太空针塔**：$40+/人，而 Day 3 早上要飞（视角更高）、明晚有 Kerry Park（构图更好），十月云层还可能让塔顶什么都看不到。

#### 变体 · 赶得上就白捡 Chihuly

Chihuly Garden and Glass 十月周四大概率 18:00 关门、**17:00 前后停止入场**。你们要过国际海关，赶不赶得上是赌的。**正式档期已排在 Day 3 13:00**，这里凑巧赶上就当白捡。

### 单轨穿 MoPOP

```trip-event
time: 17:55–18:10
category: transit
place: 单轨 Seattle Center 站
to_next: {mode: walk, minutes: 15, label: 顺 Pine St 一路下坡，走 Overlook Walk 下到海滨}
```

**坐第一节车厢** —— 看列车直接穿过 MoPOP 建筑内部。

下车后经派克市场边缘（正在收摊，明早才是主场），走 **2024 年新开的 Overlook Walk** 直接下到海滨。

### 海滨日落

```trip-event
time: 18:25–18:55
category: viewpoint
place: Waterfront Park / Pier 62
cost: Seattle Great Wheel 摩天轮 $18/人（可选）
to_next: {mode: walk, minutes: 8, label: 沿栈桥南行到 Pier 56}
```

太阳落进对岸的**奥林匹克山脉**。

**Seattle Great Wheel** 摩天轮 —— 日落时段坐最值。

### 晚餐 · 海滨

```trip-event
time: 19:15–20:45
category: food
place: Elliott's Oyster House
flags: [needs-booking]
booking: {status: required, note: Pier 56，提前订位}
cost: 约 $70/人
to_next: {mode: rideshare, minutes: 10, label: Uber 回 Astra, note: 约 $15。走回去是 20 分钟上坡，吃饱了别走}
```

**Elliott's Oyster House**（Pier 56）—— 生蚝质量最好，**顺便把蛤蜊巧达浓汤今天喝掉**（派克市场那家 11:00 才开门，明早赶不上）。

备选：**Ivar's Acres of Clams**（Pier 54，本地老字号，炸鱼薯条 + 浓汤）· **The Crab Pot**（Pier 57，砸蟹腿，体验强但出品一般，海滨在改造先确认）。

*屋顶酒吧留到明晚。*

### 回 Astra

```trip-event
time: "20:55"
category: lodging
place: Astra Hotel
```

早点睡，明天 08:45 出门。

## Day 2 · 2026-10-02

```trip-day
theme: 派克市场 → 提车向北 → Kerry Park 日落
sunset: "18:50"
lodging: Astra Hotel
fallback_order: [煤气厂公园, 日本花园门票, 苏扎罗图书馆]
```

今天的锚点是 18:00 的 Kerry Park 日落，前面所有安排都为它让路。

### 派克市场

```trip-event
time: 08:45–11:10
category: food
place: 派克市场
to_next: {mode: walk, minutes: 20, label: 沿 1st Ave 向南穿过 Pioneer Square}
```

Astra 坐电车到 Westlake 再走 8 分钟。

**飞鱼秀**（9:30 后热闹）、Post Alley、口香糖墙、第一家星巴克（队极长，拍照就走）。

**早餐吃市场小食**：**Piroshky Piroshky** 俄式馅饼 + **Le Panier** 可颂 + **Beecher's** 手工芝士通心粉。

### 提车 · 唤醒保时捷

```trip-event
time: 11:30–11:48
category: logistics
place: 唐人街提车点
flags: [warning]
cost: 保时捷 Macan 3 天 $310
to_next: {mode: drive, minutes: 12}
```

🔑 **必须 11:20 之后提，才落进 3 天计费。** 计费节点在 10/2 11:20 —— 早于这个跳 4 天，晚于这个都算 3 天。11:30 把 3 天用得最满。

**立刻三件事：** 拍全车视频存证 / 确认加 91+ 号汽油 / 贵重物品全塞后备箱。

**⚠️ 先跟车主确认：** 按 24 小时块还是自然日计费 / 可否进国家公园 / 每日里程上限（全程约 310 英里）。

### Capitol Hill · 咖啡 · 午餐 · 书店

```trip-event
time: 12:00–13:50
category: food
place: Capitol Hill
cost: 停车 Broadway 收费场 $5–10
to_next: {mode: drive, minutes: 10}
```

- **Espresso Vivace**（321 Broadway E 路边站）—— 拉花天花板
- 午餐：**Mamnoon**（中东菜，出品极稳）或 **Kedai Makan**（马来菜，味道够冲）
- **Elliott Bay Book Company**（1521 10th Ave）—— 木结构独立书店

### 华盛顿公园植物园

```trip-event
time: 14:00–15:05
category: outdoor
place: 华盛顿公园植物园
cost: 日本花园约 $10/人（可选）
to_next: {mode: drive, minutes: 10}
```

**"开保时捷压马路"兑现的地方** —— Lake Washington Blvd 湖畔林荫路配 Macan，出片靠车不靠枫叶。

**⚠️ 秋色预期：现在基本还是绿的。** 红枫峰值在十月下旬。

日本花园可选，多花 45 分钟。

### 苏扎罗图书馆

```trip-event
time: 15:15–16:03
category: sight
place: 苏扎罗图书馆
flags: [optional]
cost: Central Plaza Garage 停车约 $5
to_next: {mode: drive, minutes: 12}
```

霍格沃茨阅览室。**十月是 UW 秋季学期，校园很有生气。**

### 煤气厂公园

```trip-event
time: 16:15–17:30
category: outdoor
place: 煤气厂公园
flags: [optional]
to_next: {mode: drive, minutes: 20, note: 山上路边位极少，早到 15 分钟绕圈}
```

废土风工业遗迹，隔联合湖看天际线，和 Kerry Park 完全不同的调子。

### 凯里公园日落

```trip-event
time: 18:00–19:15
category: viewpoint
place: 凯里公园
to_next: {mode: drive, minutes: 5}
```

**今天的锚点。** 太空针 + 城市 + 远处雷尼尔一起变粉金。

**18:15–18:50 金光转粉紫，18:50–19:15 蓝调时刻更出片。**

### 晚餐 · Queen Anne

```trip-event
time: 19:20–21:00
category: food
place: How to Cook a Wolf
flags: [needs-booking]
booking: {status: required, note: 需订位}
cost: 约 $80/人
to_next: {mode: drive, minutes: 15, label: 开回 Astra 停地库}
```

**How to Cook a Wolf** —— Ethan Stowell 的意式小馆，小份多道，氛围浪漫。

备选：**Betty**（街区本地人首选，休闲一档，省 $60）· **Canlis**（全程只奢一次就选它，Queen Anne 北坡俯瞰联合湖，$150–200/人，提前几周订）。

### Altitude Sky Lounge

```trip-event
time: 21:15–23:00
category: bar
place: Altitude Sky Lounge
flags: [needs-booking]
booking: {status: required, note: 周五晚爆满，能订位就订}
cost: SpotHero 地库过夜 $10–20
```

**先停好车才能放开喝。** SpotHero 封闭安保地库 $10–20 过夜，**不要停露天路边**。

顶层屋顶酒吧直面亮灯的太空针塔。

## Day 3 · 2026-10-03

```trip-day
theme: 飞天 → 玻璃球 → 玻璃花 → 雪山暮光
sunset: "18:48"
lodging: Ashford 木屋
weather_note: 十月早晨常有海雾低云，水上飞机有取消风险
```

**十月第一个周六** —— 亚马逊玻璃球这趟唯一的开放日，不可移动。

**为什么水上飞机放上午：** ① 上午气流稳，下午热对流明显更颠 ② 空腹或轻食上飞机比刚吃完午饭好 ③ **决定性理由 —— 上午被取消还有一整个下午当天补飞（12:30 / 13:30 场）；订 14:00 被取消就彻底没了**，因为下午必须南下赶日落。

### 早餐 + 退房

```trip-event
time: 09:00–09:45
category: logistics
place: Astra Hotel
flags: [warning]
to_next: {mode: walk, minutes: 10, label: 走去 Kenmore Air 码头}
```

行李寄存前台，**或一次性锁进后备箱后今天再也不打开**。

🔒 **西雅图车内盗窃率很高，后座绝不能有可见行李。**

### 水上飞机天际线之旅

```trip-event
time: 10:00–11:00
category: experience
place: Kenmore Air 联合湖码头
flags: [needs-booking]
booking: {status: required, note: 订 10:00 场，问清取消改期政策}
cost: $159 × 2 = $318
to_next: {mode: walk, minutes: 15}
```

水面滑行起飞，上帝视角俯瞰市中心和整片湖区。

📌 市中心上空有空域限制，**不会绕着太空针塔盘旋**，是从侧上方远观。

💊 **非嗜睡型晕车药 + 姜糖，起飞前 30 分钟吃。**

#### 变体 · 海雾没散

顺延到 **12:30 / 13:30 场**，砍掉 Chihuly，整体往后推。Classic Seattle Tour 只飞 20 分钟左右，就算颠也很短。

### 亚马逊玻璃球

```trip-event
time: 11:30–12:45
category: sight
place: 亚马逊玻璃球
flags: [needs-booking]
booking: {status: required, note: 每月仅第一、三个周六对公众开放，名额放出即抢空}
to_next: {mode: monorail, minutes: 15, label: 走回 Westlake 5 分钟，单轨到 Seattle Center}
```

**这趟唯一的开放日**，凭预约进入。玻璃穹顶内的热带雨林，1 小时够。

### Chihuly Garden and Glass

```trip-event
time: 13:00–14:10
category: sight
place: Chihuly Garden and Glass
flags: [needs-booking]
booking: {status: required, note: 一周内订 13:00 时段票}
cost: 约 $35 × 2 = $70
to_next: {mode: walk, minutes: 20, label: 回 Astra 装车}
```

玻璃艺术，室内 + 温室 + 户外花园，**极度出片，也是全程最好的雨天保险**。逛 60–75 分钟。

#### 变体 · Day 1 已经逛过

跳过，13:00 直接装车南下，多出 2 小时缓冲。

### 装车南下

```trip-event
time: 14:30–15:00
category: logistics
place: Astra Hotel
to_next: {mode: drive, minutes: 55, km: 70, label: I-5 向南到 Bonney Lake}
```

退房行李全部上车。

### 补货 · 今晚的晚餐在这里买

```trip-event
time: 16:15–17:30
category: logistics
place: Bonney Lake 补货点
flags: [warning]
to_next: {mode: drive, minutes: 25}
```

**别跳过这一站。** Bonney Lake 或 Puyallup 的 Fred Meyer / Safeway。

买：熟食或牛排、奶酪、水果、酒、零食、**明早的咖啡和面包、以及 Day 4 中午的三明治**。

🍽️ **为什么今晚不去餐厅：** Ashford 的 Copper Creek Inn 通常 20:00 前后打烊，看完 18:48 的日落再开 1 小时 20 分过去必定吃闭门羹。改成中午吃好，晚上买好东西带回木屋，泡着雪松泡池慢慢吃。

### Tehaleh 追日落

```trip-event
time: 18:00–19:05
category: viewpoint
place: Tehaleh Rainier View Point
to_next: {mode: drive, minutes: 80, label: 走 Orting / Eatonville 到 Ashford}
```

Bonney Lake 观景台，**日落 18:48**。零遮挡，巨大的雷尼尔怼在眼前被染成玫瑰金。

拍到 19:05 暮光散尽再走。**全程最好的车 + 雪山合影机位。**

### 入住 Ashford 木屋

```trip-event
time: "20:30"
category: lodging
place: Ashford 木屋
flags: [tentative, needs-booking]
booking: {status: required, note: 5 选 1 未定，见附录。订前必须问泡池是独享还是公用}
cost: $250–400
```

泡池 + 带回来的酒菜 + 星空。

**⚠️ 山区夜里 4–7°C，厚外套 + 拖鞋 + 泳衣。**

📱 **睡前查一次 NPS 步道状况，决定明早走环线还是往返。**

## Day 4 · 2026-10-04

```trip-day
theme: 雷尼尔 · Skyline 顺时针环线
sunset: "18:46"
lodging: Renaissance Seattle
weather_note: 十月初 Panorama Point 以上常年雪原、Golden Gate 开阔坡面可能积雪结冰
```

**⚠️ 全程唯一的硬核长日：7:15 出门，18:30 落地 Kent。**

**为什么顺时针：** 核心是"好东西在正前方还是背后"。上山走西侧（Deadhorse Creek → Glacier Vista）一路朝北，**雷尼尔和尼斯阔利冰川就在正前方**；下山走东侧（Golden Gate → Myrtle Falls）一路朝南，**正前方是 Tatoosh 山脉**，后面叠着亚当斯山和胡德山。逆时针走则两次都得回头看。附带：西侧陡东侧缓，陡的上缓的下，膝盖友好；Myrtle Falls 那张照片落在 11 点多的光线里比 8 点 50 分的阴影里好得多。

### 出发 · 西南门

```trip-event
time: "07:15"
category: logistics
place: Ashford 木屋
to_next: {mode: drive, minutes: 75, km: 29, label: 木屋 → Nisqually 门 15 分钟 → Paradise 约 50 分钟（18 英里盘山）}
```

清晨无车跑山，**08:30 到 Paradise 轻松找位**（周日 10:00 后停车场就满）。

早餐吃昨晚买的。想喝正经咖啡：Ashford 的 **Whittaker's** espresso 吧开得早。

### Skyline 顺时针环线

```trip-event
time: 08:45–11:45
category: outdoor
place: Paradise
flags: [warning]
cost: 雷尼尔门票 $30/车（7 天有效）
to_next: {mode: drive, minutes: 15, label: 离开 Paradise 向东}
```

**约 4.3 英里，爬升 430 米。** Paradise → Deadhorse Creek → Glacier Vista → Panorama Point → Low Skyline 向东 → Golden Gate 下切 → Myrtle Falls → Paradise。

**十月初高山灌木（越橘、花楸）秋色正在峰值**，红黄一片配冰川。

Panorama Point 海拔 6,800 英尺（Paradise 5,400），少数人会有轻微高度反应，慢一点就好。清晨步道结霜，慢一点。

**必带：轻便冰爪（microspikes）+ 登山杖。**

#### 变体 · Panorama 以上或 Golden Gate 有雪

改走**顺时针往返**：上 Deadhorse Creek 到 Panorama Point，原路下来，最后加走 Myrtle Falls 支线（往返 0.8 英里）。约 4 英里。

Golden Gate 挂在开放坡上，铺雪之后滑下去很麻烦。

**怎么查：** 前一晚从木屋查 NPS 的 Mount Rainier 步道状况页；早上 Paradise 停车场有状况告示板。**Jackson 游客中心十月可能 10:00 才开门，你们 08:45 就出发，别指望问到人。**

### 倒影湖 · 吃打包的午餐

```trip-event
time: 12:00–12:25
category: outdoor
place: 倒影湖
flags: [warning]
to_next: {mode: drive, minutes: 5}
```

无风时能拍到完整雪山倒影。

**⚠️ 必须自带午餐。Longmire 以东、Paradise 以外整条线没有任何吃饭的地方。**

### Stevens Canyon Road 跑山

```trip-event
time: 12:30–13:45
category: viewpoint
place: Stevens Canyon Road
to_next: {mode: drive, label: 继续沿 123 号 / 410 公路北上}
```

反向进山的游客在西门堵成一条，你们一路畅通。顺路可停 Box Canyon。

🚫 Grove of the Patriarchs 因吊桥损毁长期关闭，别绕过去。

### Tipsoo Lake 湖边小环线

```trip-event
time: 13:45–14:15
category: outdoor
place: Tipsoo Lake
to_next: {mode: drive, minutes: 45, label: 走 410 经 Cayuse Pass 向北}
```

东侧 Chinook Pass。**只走湖边约 0.5 英里，10 分钟拿到 90% 的景。**

### Crystal Mountain 缆车

```trip-event
time: 15:00–16:30
category: experience
place: Crystal Mountain 缆车
flags: [tentative]
cost: 约 $49 × 2 = $98
to_next: {mode: drive, minutes: 105, km: 110, label: 下山向西北到 Kent}
```

10 分钟上到 **6,872 英尺**，山顶正对雷尼尔全貌。

**前提：必须已确认 10/4 运营。** 秋季一般只开周五–周日，十月上旬就收，10/4 在临界线上。

🚫 **为什么砍掉 Sunrise：** Sunrise Road 十月上旬随时季节性关闭，且从 Tipsoo 往返 3 小时只换一个 Emmons Vista 眺望点，性价比远低于 Crystal 缆车。

#### 变体 · 缆车没开

跳过，**17:00 就能到城南**，多出的时间给 Kent 的和牛和酒店泡澡。

### 完美收官 · Kent 和牛烤肉

```trip-event
time: 18:30–20:15
category: food
place: Asadero Sinaloa
cost: 约 $90/人
to_next: {mode: drive, minutes: 30, label: Kent → 市中心}
```

**Asadero Sinaloa 发源老店**（Kent, Central Ave）—— 顶级和牛烤肉配重口莎莎。

备选：**Bai Tong**（当年为泰航机组开的泰餐，本地传奇）· **Din Tai Fung**（Southcenter）。

🚗 **吃完顺路把油加满**，明早还车前就不用再操心。

### 入住 Renaissance Seattle

```trip-event
time: "20:45"
category: lodging
place: Renaissance Seattle
flags: [tentative, needs-booking]
booking: {status: required, note: 第三张 50K 券。换不出来退 Courtyard Pioneer Square}
cost: SpotHero 停车 $20–35
```

**SpotHero 找 Pioneer Square 附近地库过夜。** 酒店代客要 $55–70。

**⚠️ 行李全部搬进房间，车里不留任何东西。**

住市中心的最大好处：**Day 5 早上完全不用开车** —— 走去吃早茶、走去还车、走到轻轨站。这在一个要卡 3 小时缓冲的国际航班日，是最大的风险削减。

## Day 5 · 2026-10-05

```trip-day
theme: 走着吃早茶，准点飞离
sunset: "18:44"
```

**倒推链不可压缩。** 前一晚已收好行李、网上办好登机。

### 起床

```trip-event
time: 09:00–09:45
category: logistics
place: Renaissance Seattle
to_next: {mode: walk, minutes: 15, label: 走去唐人街}
```

行李昨晚已收好，登机牌已办。

### 早茶 · 唐人街

```trip-event
time: 10:00–11:10
category: food
place: Jade Garden
flags: [warning]
cost: 约 $30/人
to_next: {mode: walk, minutes: 8, label: 走回还车点}
```

**Jade Garden** —— 推车点心，老派 ID 体验，早上就开，周一人少。

备选：**Harbor City**（同样早开，港式点心）· **Tai Tung**（西雅图最老的中餐馆，李小龙常去）。

⚠️ Dough Zone 这类 11:00 才开门的赶不上。**ID 部分老店周一休息，确认一家 + 备选一家。**

⚠️ 马上要坐长途飞机，重油川菜不是好主意，点心更聪明。

### 还车

```trip-event
time: 11:20–11:35
category: logistics
place: 唐人街提车点
flags: [warning]
to_next: {mode: walk, minutes: 10, label: 走到 Chinatown-ID 轻轨站}
```

🔑 **11:20 硬截止。**

还车前：**拍全车视频 / 清空车内**（油昨晚已加满）。

### Chinatown-ID 站上轻轨

```trip-event
time: "11:45"
category: transit
place: Chinatown-ID 轻轨站
to_next: {mode: rail, minutes: 36, label: 1 Line 直达 SEA}
```

36 分钟到 SEA 轻轨站。

### 进航站楼

```trip-event
time: 12:25–12:40
category: logistics
place: SEA 机场
```

国际航班，3 小时缓冲。*绝对底线 13:10，但别拿这个当计划。*

### 航班起飞

```trip-event
time: "15:40"
category: flight
place: SEA 机场
flight: {from: SEA, dep_time: "15:40"}
```

回家。

## 附录 · 出发前必办清单

```trip-ref
id: checklist
icon: ✅
```

### 现在就做

1. **亚马逊玻璃球 10/3 预约 · 订 11:30 场** —— 每月仅第一、三个周六对公众开放，名额放出即抢空
2. **水上飞机 10/3 · 订 10:00 场** —— Kenmore Air（950 Westlake Ave N，离 Astra 步行 10 分钟）。问清取消改期政策
3. **Astra 两晚：50K 券 + 补 5,000 点** —— 万豪允许给免房券最多加 15,000 点，55K = 50K 券 + 5K 点，两晚共补 10,000 点。官网不显示补点选项就直接打客服电话。确认券有效期覆盖 10/1
4. **Day 4 万豪：Renaissance Seattle**（第三张 50K 券）
5. **Ashford 木屋 10/3（周六）** —— 订之前必须问：泡池是独享还是公用

### 一周内

- **Chihuly Garden and Glass 10/3 下午 13:00 时段票**
- **餐厅订位**：Elliott's（10/1 晚）、How to Cook a Wolf（10/2 晚）、**Altitude Sky Lounge（10/2 晚，周五爆满）**
- SpotHero 下载 + 预订 10/2、10/4 两晚车位
- **买轻便冰爪（microspikes）+ 登山杖**、非嗜睡型晕车药、姜糖

### 出发前 3 天

- **NPS 雷尼尔步道与道路状况页** —— 两件事都要查：
  - 道路：Stevens Canyon Rd / Hwy 410 Chinook Pass 是否因早雪封闭
  - 步道：**Panorama Point 以上和 Golden Gate 是否积雪**（决定 Day 4 走环线还是往返）
- **Crystal Mountain 缆车 10/4 是否运营** —— 秋季一般只开周五–周日，十月上旬就收，10/4 在临界线上
- 雷尼尔 2026 时段预约制是否已结束
- **查 10/3 月相** —— 满月的话 Ashford 星空基本没了
- 逐个确认餐厅营业状态（西雅图这几年关店率高）

## 附录 · Ashford 住宿备选

```trip-ref
id: lodging-ashford
icon: 🏡
```

**⚠️ Ashford 在森林河谷里，树很高，"房间里看得到雷尼尔"基本不存在。** 宣传里的 mountain view 多半是林景。雪山视觉在 Day 3 傍晚的 Tehaleh 和 Day 4 早上的 Paradise —— 这一晚买的是**私密泡池 + 森林感**。

| 选择 | 泡池 | 特点 | 价位 |
| :-- | :-- | :-- | :-- |
| **Stormking Spa + Cabins** ⭐ | **每间木屋独立雪松泡池** | 仅限成人，有正规 spa 可约按摩，最安静私密 | $300–400 |
| **Wellspring Spa & Woodland Retreat** ⭐ | **私人露天雪松浴桶 + 柴烧桑拿** | Ashford 最"泡"的一家，树屋/原木屋风格古怪有趣 | $200–320 |
| **Jasmer's at Mt. Rainier** | 部分单元私人泡池 | 独立小屋，内装收拾得好，带壁炉 | $200–300 |
| **Deep Forest Cabins** | 部分单元私人泡池 | 位置隐蔽，林中独栋，安静 | $200–300 |
| **Mounthaven Resort** | 部分单元有泡池 | **离园区大门不到 1 英里**，带厨房 | $180–280 |

**订之前必须问四件事：**

1. **泡池是这间独享还是公用的？**（很多列表写 hot tub 其实是共用一个）
2. 有没有使用时段限制？（有些 22:00 静音）
3. **到店时水是不是已经烧热？**（你们 20:30 才到）
4. 周末是否有"最少住两晚"限制

**🎯 顺手查 Paradise Inn** —— 在国家公园里面，第二天推开门就是 Skyline 起点，白送 40 分钟清晨山路。但季节性营业，**通常十月上旬关门**，且没泡池。

## 附录 · Day 4 住宿备选

```trip-ref
id: lodging-day4
icon: 🏨
```

**券最多可再补 15,000 点，65K 以内的房都能换 —— 换越贵的房，券越不浪费。**

| 万豪 | 走到唐人街 | 周日晚约需点数 | 券价值 |
| :-- | :-- | :-- | :-- |
| **Renaissance Seattle** ⭐ | 15 分钟 | 40–50K | **最优** |
| **The Westin Seattle** | 20 分钟 | 40–55K | 好 |
| **W Seattle** | 15–18 分钟 | 50–60K（可能补点） | 好 |
| **Courtyard Downtown/Pioneer Square** | **10 分钟，最近** | 30–40K | 一般（券略浪费） |
| **Seattle Marriott Waterfront** | 25 分钟 | 50–70K（要补点） | 好，但离 ID 最远 |

**推荐 Renaissance Seattle**，换不出来退 **Courtyard Pioneer Square**。

## 附录 · 租车与停车

```trip-ref
id: car
icon: 🚗
```

**租期：3 天，10/2 11:30 → 10/5 11:20**

**提车时间为什么是 11:30：** 计费节点在 **10/2 11:20** —— 早于这个跳 4 天，晚于这个都算 3 天。11:30 把 3 天用得最满。

**⚠️ 先跟车主确认三件事：** 按 24 小时块还是自然日计费 / 可否进国家公园 / 每日里程上限（全程约 310 英里）

**停车策略（全程 SpotHero）：**

| 时间 | 地点 | 费用 |
| :-- | :-- | :-- |
| 10/2 夜 | Astra 附近写字楼封闭地库 Evening Rate | $10–20 |
| 10/2 白天 | Broadway 收费场（Capitol Hill）、Central Plaza Garage（华大） | 各 $5–10 |
| 10/4 夜 | Pioneer Square / 市中心地库 | $20–35（酒店代客要 $55–70） |

## 附录 · 日期运气与风险

```trip-ref
id: risks
icon: 📅
```

**运气：**

- 10/3 是十月**第一个周六** → 亚马逊玻璃球开放（**这趟唯一的开放日，不可移动**）
- 10/4 高山秋色接近峰值，雷尼尔夏季时段预约制通常已结束

**风险：**

- 十月初雨季过渡，约五成概率遇雨
- Sunrise Road 与 Crystal 缆车都进入季节性关闭窗口
- Panorama Point 以上可能已积雪
- **市区秋色还没上色**，植物园红枫峰值在十月下旬
- 十月初西雅图水手队可能在季后赛，市区酒店和交通会有临时溢价

**日落时间：** 10/1 18:52 · 10/2 18:50 · 10/3 18:48 · 10/4 18:46 · 10/5 18:44

## 附录 · 雨天预案

```trip-ref
id: rain
icon: 🌧️
```

**如果 10/4 雷尼尔被云雾封死**，别硬上 Panorama Point。改走低海拔雨林线：

- **Christine Falls / Narada Falls** —— 路边瀑布，雨天水量更大更美
- **Longmire 历史区 + Trail of the Shadows** —— 0.7 英里环线，古木苔藓，雨中氛围极佳
- **Carbon River 雨林** —— 西北门，温带雨林，全程平坦

然后提早下山，把时间给 Kent 的和牛和酒店泡澡。

**市区遇雨的室内备选：** Chihuly（已在 Day 3）· MoPOP · Seattle Aquarium（Day 1 顺路）· Elliott Bay Book Company（已在 Day 2）

## 附录 · 预算

```trip-ref
id: budget
icon: 💰
```

双人，不含机票。

| 支出类别 | 说明 | 预估（USD） |
| :-- | :-- | --: |
| **Astra 2 晚** | 50K 券 × 2 + 补 10,000 点 | **$0**（点数） |
| **Renaissance Seattle 1 晚** | 50K 券 + SpotHero 停车 $30 | **$30** |
| **Ashford 木屋** | Stormking / Wellspring | **$250 – $400** |
| **租车** | 保时捷 Macan **3 天** | **$310** |
| **油费** | 约 310 英里 × 91+ 号高价油 | **$85** |
| **市区交通与停车** | ORCA + 单轨 + 电车 + Day 1 Uber + 白天停车 + Day 2 地库 | **$115** |
| **水上飞机** | $159 × 2 | **$318** |
| **Chihuly** | 约 $35 × 2 | **$70** |
| **摩天轮（可选）** | $18 × 2 | **$0 – $36** |
| **雷尼尔门票** | $30/车（7 天有效） | **$30** |
| **日本花园（可选）** | 约 $10 × 2 | **$0 – $20** |
| **Crystal 缆车（可选）** | $49 × 2 | **$0 – $100** |
| **冰爪 + 登山杖** | 一次性装备 | **$60 – $100** |
| **餐饮** | 日均约 $130–160，含 Safeway 补货 | **$620 – $780** |
| **总计** | | **约 $1,890 – $2,390** |

**💡 四晚住宿全靠免房券，现金只出 Ashford 一晚 + 两晚停车。**

**想压到 $1,750 以内，按顺序砍：**

1. Ashford 选 Mounthaven（$200 档）而非 Stormking → 省 $150
2. 跳过 Crystal 缆车 → 省 $100
3. 跳过摩天轮和日本花园 → 省 $56
4. Day 2 晚餐选 Betty 而非 How to Cook a Wolf → 省 $60

**⚠️ 最大变量：** 如果 Astra 补点换房换不出来，现金价约 $250–350/晚，**总预算跳到 $2,490–2,990**。

## 附录 · 打包清单

```trip-ref
id: packing
icon: 🎒
```

**山上专用**

- **轻便冰爪（microspikes）+ 登山杖** —— Panorama Point 以上十月可能结冰
- **抓地好的徒步鞋**
- **防水外套**（不是伞，山上有风）
- 太阳镜（雪面反光强）+ 防晒

**分层保暖** —— 市区白天 13–18°C，Paradise 早上 0–3°C，Ashford 木屋夜里 4–7°C

**其他**

- **非嗜睡型晕车药 + 姜糖** —— Day 3 早上水上飞机前 30 分钟
- **泳衣 + 拖鞋** —— Ashford 泡池
- 保温杯 / 车载充电器 / 移动电源
- ORCA 卡，或手机 Apple Pay 直接刷闸机
- **Global Entry 卡（如果有）** —— Day 1 能省 30 分钟
