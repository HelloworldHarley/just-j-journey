---
id: _demo
title: 全要素演示 · 东京箱根京都
subtitle: 本地开发专用 · 线上不可见
destination: Tokyo–Hakone–Kyoto, Japan
timezone: Asia/Tokyo
start: 2026-11-20
end: 2026-11-23
travelers: 2
currency: JPY
---

# 全要素演示 · 东京箱根京都

## 硬约束

```trip-constraints
- kind: arrive
  at: 2026-11-20 15:30
  label: 抵达 HND
- kind: checkin
  at: 2026-11-21 15:00
  label: 强罗雪月花入住
- kind: reservation
  at: 2026-11-20 19:00
  label: 泥鳅锅订位
- kind: checkout
  at: 2026-11-23 10:00
  label: 京都退房
- kind: deadline
  at: 2026-11-23 16:30
  label: 必须到关西机场
- kind: depart
  at: 2026-11-23 19:05
  label: 离开 KIX
```

## 租车

```trip-rentals
- what: 丰田 Yaris Cross
  platform: Times Car Rental
  from: "2026-11-21 10:30"
  to: "2026-11-22 08:40"
  pickup: 箱根汤本站
  dropoff: 小田原站
  mileage: 不限
  insurance: 全险 + 免赔额 ¥0
  refund: 取车前 24 小时免费取消
```

## 地点表

```trip-places
- name: 羽田机场
  en: Tokyo Haneda Airport
  coord: 35.5494, 139.7798
  category: flight
- name: 浅草豪景酒店
  en: Asakusa View Hotel
  coord: 35.7136, 139.7920
  category: hotel
- name: 仲见世通
  en: Nakamise Shopping Street Asakusa
  coord: 35.7118, 139.7966
  category: snack
- name: 驹形泥鳅锅
  en: Komagata Dozeu Asakusa
  category: food
- name: 浅草屋顶酒吧
  en: Asakusa Rooftop Bar
  category: bar
- name: 新宿站
  en: Shinjuku Station
  coord: 35.6896, 139.7006
  category: transit
- name: 大涌谷
  en: Owakudani Hakone
  coord: 35.2444, 139.0194
  category: outdoor
- name: 桃源台港
  en: Togendai Port Lake Ashi
  category: experience
- name: 强罗雪月花
  en: Gora Setsugetsuka Hakone
  category: homestay
- name: 箱根汤本站
  en: Hakone-Yumoto Station
  coord: 35.2325, 139.1067
  category: transit
- name: 小田原站
  en: Odawara Station
  category: transit
- name: 锦市场
  en: Nishiki Market Kyoto
  coord: 35.0050, 135.7649
  category: snack
- name: 清水寺
  en: Kiyomizu-dera Kyoto
  coord: 34.9949, 135.7850
  category: sight
- name: 鸭川三条河原
  en: Kamo River Sanjo Kyoto
  category: viewpoint
- name: 京都格兰比亚酒店
  en: Hotel Granvia Kyoto
  coord: 34.9858, 135.7588
  category: hotel
- name: 先斗町
  en: Pontocho Alley Kyoto
  category: food
- name: 六曜社珈琲店
  en: Rokuyosha Coffee Kyoto
  category: cafe
- name: 京都站
  en: Kyoto Station
  coord: 34.9858, 135.7588
  category: transit
- name: 莫利亚三宫本店
  en: Mouriya Kobe Beef Sannomiya
  category: food
- name: 神户机场海上码头
  en: Kobe Airport Bay Shuttle Terminal
  category: transit
- name: 关西机场
  en: Kansai International Airport
  coord: 34.4342, 135.2328
  category: flight
```

## Day 1 · 2026-11-20

```trip-day
theme: 落地东京，浅草的第一晚
sunrise: "06:19"
sunset: "16:32"
lodging: 浅草豪景酒店
lodging_note: 高层朝隅田川的房要单独邮件要
```

演示日：中转航班、跨日出发、多人一人一票、全空待填骨架、模糊时段、预订状态。

### 抵达东京 · 汇合

```trip-event
time: "15:30"
category: flight
place: 羽田机场
notes:
  - 国际到达高峰排队 30 分钟起，落地先连机场 Wi-Fi 报平安
transport:
  - {traveler: 我, mode: flight, carrier: 达美 Delta, number: DL7, from: LAX, to: HND T3, dep_date: "2026-11-19", dep_time: "08:05", arr_time: "15:30", arr_day_offset: 1, duration: 14h25m, cabin: 经济舱, baggage: 2 件 23kg, through_check: 行李直挂, refund: 改签 $200 起, price: "$842", stops: [{airport: SEA, arr_time: "10:55", dep_time: "13:35", leg: 2h50m, wait: 2h40m}]}
  - {traveler: 她, mode: flight, from: PVG, to: HND, note: 票未定，全部槽位等着填}
to_next: {mode: rail, minutes: 40, label: 京急线直通浅草线}
```

我从洛杉矶经西雅图转机，前一天起飞、次日下午落地（西行跨日期变更线）；她从上海直飞，票还没买。

### 入住 · 浅草豪景酒店

```trip-event
time: 16:40–17:10
category: hotel
place: 浅草豪景酒店
booking: {status: required, deadline: 2026-11-01, note: 高层河景房要邮件单独确认}
cost: "¥36000"
to_next: {mode: walk, minutes: 12, label: 穿过传法院通}
```

住宿信息一个字段都没写 —— 观察模块里五个槽位全部「待填」的样子。

### 小吃 · 仲见世通

```trip-event
time: 17:30–18:20
category: snack
place: 仲见世通
cost: 约 ¥1500/人
to_next: {mode: walk, minutes: 8}
```

人形烧、炸馒头、现烤仙贝，边走边吃。

### 晚餐 · 驹形泥鳅锅

```trip-event
time: evening
category: food
place: 驹形泥鳅锅
flags: [needs-booking]
booking: {status: booked, note: 已订 19:00 两位，报手机尾号即可}
```

两百年老店。时间写的是 `evening` —— 观察时间列显示「傍晚」而非具体时刻；预订状态是「已预订」灰调模块。

### 屋顶酒吧

```trip-event
time: 21:00–22:30
category: bar
place: 浅草屋顶酒吧
flags: [tentative, optional]
cost: 约 ¥2000/人
```

去不去看当天状态 —— 同时挂「待定」角标和可选虚线左边条。

## Day 2 · 2026-11-21

```trip-day
theme: 浪漫特快进箱根，温泉旅馆躺平
sunrise: "06:20"
sunset: "16:31"
lodging: 强罗雪月花
```

演示日：全天事件、火车票（票价已填）、自驾与租车模块、多条注意合框、可选费用、民宿模块五格全满。**时间不够就按 大涌谷 → 海盗船 的顺序往下砍。**

### 箱根周游券 · 区内交通随便坐

```trip-event
time: allday
category: logistics
```

登山电车、缆车、海盗船、巴士全含 —— 观察「全天」时间标签和事务卡的透明底。

### 浪漫特快 · 新宿→箱根汤本

```trip-event
time: "09:00"
category: rail
place: 新宿站
transport: {mode: rail, carrier: 小田急, number: はこね 51 号, from: 新宿, to: 箱根汤本, dep_time: "09:00", arr_time: "10:25", duration: 1h25m, cabin: 展望席, refund: 发车前可免费改签, price: "¥2470/人"}
to_next: {mode: walk, minutes: 5, label: 站前取车}
```

展望席在第一节车厢，提前 30 天放票。

### 提车 · 箱根自驾

```trip-event
time: 10:30–10:50
category: drive
place: 箱根汤本站
cost: "¥14800"
notes:
  - 山路弯多，大涌谷一带冬季可能要求雪胎或防滑链
  - 异地还车加收 ¥2200 · 免 ETC 卡需自带
to_next: {mode: drive, minutes: 10, label: 沿国道 1 号上山}
```

演示自驾类别与租车信息模块 —— 异地还车（箱根汤本取、小田原还）。

### 大涌谷

```trip-event
time: 11:00–12:30
category: outdoor
place: 大涌谷
flags: [warning]
cost: 黑蛋 ¥500（可选）
notes:
  - 硫磺味重，呼吸道敏感慎入
  - 大风时缆车停运，改乘代行巴士上山
to_next: {mode: bus, minutes: 30}
```

活火山谷地，黑蛋据说吃一颗延寿七年。

### 海盗船游芦之湖

```trip-event
time: 13:30–14:20
category: experience
place: 桃源台港
cost: ¥1200/人
to_next: {mode: bus, minutes: 20}
```

晴天能看到富士山探头。

#### 变体 · 雾太大什么都看不到

跳过海盗船，直接去雕刻之森美术馆，室内为主还有温泉足汤。

### 入住 · 强罗雪月花

```trip-event
time: "15:30"
category: homestay
place: 强罗雪月花
stay: {platform: 一休.com, stars: 4, room: 和洋室 · 半露天风吕, parking: 含 · 免费 3 台, breakfast: 含 · 会席早餐}
booking: {status: booked, note: 含晚餐会席，15:00 后可入住}
cost: "¥52000"
```

住宿模块五个字段全部填满 —— 对照 Day 1 的全待填。

### 会席晚餐

```trip-event
time: 18:00–19:30
category: food
```

房费已含，餐厅在馆内 —— 没有地点也没有费用的最小卡片。

## Day 3 · 2026-11-22

```trip-day
theme: 新干线换乘进京都，古都压马路
sunrise: "06:39"
sunset: "16:47"
lodging: 京都格兰比亚酒店
```

演示日：高铁换乘票、下午模糊时段、警告注意、可选卡、酒店模块半填、识别不出金额的费用。

### 还车 · 小田原站

```trip-event
time: 08:40–08:55
category: drive
place: 小田原站
to_next: {mode: walk, minutes: 10, label: 走进新干线检票口}
```

异地还车。这张卡在「行」筛选里会被折叠 —— 同一辆车只留取车那张。

### 新干线 · 小田原→京都

```trip-event
time: "09:12"
category: hsr
place: 小田原站
transport: {mode: hsr, carrier: JR 东海, number: ひかり 635 → のぞみ 219, from: 小田原, to: 京都, dep_time: "09:12", arr_time: "11:14", duration: 2h02m, cabin: 指定席, baggage: 特大行李需预约行李位, price: "¥11,220/人", stops: [{station: 名古屋, arr_time: "10:19", dep_time: "10:31", leg: 1h07m, wait: 12m}]}
to_next: {mode: walk, minutes: 25, label: 出站顺乌丸通往北散步}
```

名古屋换乘 12 分钟 —— 观察高铁票的换乘虚线段。

### 午餐 · 锦市场

```trip-event
time: afternoon
category: snack
place: 锦市场
cost: 约 ¥2500/人
to_next: {mode: bus, minutes: 20, label: 206 路到五条坂}
```

京都的厨房，玉子烧、豆乳甜甜圈、章鱼小丸子。

### 清水寺

```trip-event
time: 15:00–16:30
category: sight
place: 清水寺
flags: [warning]
notes:
  - 三年坂石阶陡，雨天很滑，穿好走的鞋
to_next: {mode: walk, minutes: 20, label: 顺产宁坂下山}
```

清水舞台悬空 13 米，秋枫季 16:00 后逆光最好看。

### 鸭川夕照

```trip-event
time: 17:00–17:40
category: viewpoint
place: 鸭川三条河原
flags: [optional]
to_next: {mode: walk, minutes: 15}
```

赶得上就在河原坐一会儿 —— 可选卡，左边条是虚线。

### 入住 · 京都格兰比亚

```trip-event
time: "18:10"
category: hotel
place: 京都格兰比亚酒店
stay: {platform: 万豪, stars: 5}
to_next: {mode: walk, minutes: 15}
```

住宿模块只填了平台和星级 —— 房型/停车/早餐三格待填。

### 晚餐 · 先斗町

```trip-event
time: 19:30–21:00
category: food
place: 先斗町
cost: 看店家时价
```

窄巷里挑一家看着顺眼的居酒屋。费用写的是「看店家时价」—— 观察预算页明细里这行金额显示「—」且不计入总额。

## Day 4 · 2026-11-23

```trip-day
theme: 神户快闪，海上进机场
sunrise: "06:41"
sunset: "16:46"
```

演示日：上午模糊时段、巴士票、轮渡票、待订角标、东行同日到达。

### 咖啡 · 六曜社

```trip-event
time: morning
category: cafe
place: 六曜社珈琲店
cost: 约 ¥800/人
```

昭和老咖啡店，自家烘焙配甜甜圈。

### 高速巴士 · 京都→三宫

```trip-event
time: "11:30"
category: bus
place: 京都站
transport: {mode: bus, carrier: 阪急观光巴士, from: 京都站乌丸口, to: 三宫巴士总站, dep_time: "11:30", arr_time: "12:45", duration: 1h15m, cabin: 4 排标准席, refund: 开车前 30 分钟可免费取消, price: "¥1100", stops: [{airport: 大阪梅田 · 阪急三番街, dep_airport: 新阪急酒店前, arr_time: "12:10", dep_time: "12:20", leg: 40m, wait: 10m}]}
to_next: {mode: walk, minutes: 10}
```

#### 变体 · 高速公路堵车

改乘 JR 新快速，京都到三ノ宮 52 分钟，班次密不用赶。

### 神户牛午餐

```trip-event
time: 13:15–14:30
category: food
place: 莫利亚三宫本店
flags: [needs-booking]
cost: 约 ¥8000/人
to_next: {mode: rail, minutes: 20, label: Port Liner 到神户机场}
```

铁板烧吧台位看现切现煎 —— 还没订位，标题旁是琥珀「待订」角标（没写 booking 块）。

### 海上巴士 · 神户→关西机场

```trip-event
time: "15:30"
category: ferry
place: 神户机场海上码头
transport: {mode: ferry, carrier: 神户-关空湾快线, from: 神户机场码头, to: 关西机场 T1, dep_time: "15:30", arr_time: "16:01", duration: 31m, cabin: 普通舱, price: "¥1880"}
to_next: {mode: walk, minutes: 10, label: 码头接驳到 T1}
```

跨大阪湾 31 分钟，比陆路快一个小时。

### 各自起飞

```trip-event
time: "19:05"
category: flight
place: 关西机场
transport:
  - {traveler: 她, mode: flight, from: KIX, to: PVG, dep_time: "19:05", note: 票未定}
  - {traveler: 我, mode: flight, carrier: 联合 United, number: UA34, from: KIX T1, to: SFO, dep_time: "18:30", arr_time: "11:10", duration: 9h40m, cabin: 经济舱, baggage: 2 件 23kg, refund: 不可退，改签 $150 起, price: "$715", note: 东行跨日期变更线，同日上午落地}
```

我的航班 18:30 起飞、当天上午 11:10 落地 —— 东行赚回一天，观察右端日期仍是 11/23。

## 附录 · 预算说明

```trip-ref
id: budget
icon: 💰
```

这一段演示**预算类附录**：它渲染在预算页底部、自动统计的下面，资料页看不到它。

隐性支出示例：箱根周游券 ¥6100/人 若买则黑蛋缆车海盗船全含，上面的可选费用可抵消。

## 附录 · 演示说明

```trip-ref
id: demo-guide
icon: 🧪
```

这份行程是**渲染试验场**，只在本地开发时出现（`_` 前缀不入 manifest，CI 部署前删除目录）。每天负责一组情况：

### Day 1 · 航班与待填

- **中转航班**：我的 DL7 经 SEA 停 2h40m —— 每段上方标时长（2h50m + 停 2h40m + 8h55m = 全程 14h25m），中转两端标到发当地时间
- **跨日出发**：`dep_date: 11-19` + `arr_day_offset: 1` —— 左端日期 11/19、右端 11/20 带红色 +1 角标
- **描述行**：客舱/托运/直挂/退改四格（她的票全待填）
- **多人一人一票**：她的票全空 —— 航司/航班号/时刻/预算全是待填槽
- **住宿模块全待填**：入住卡五个槽位全空
- **预订两态**：酒店「需预订 + 截止日」琥珀，泥鳅锅「已预订」灰调
- **模糊时段**：晚餐 `evening` → 时间列显示「傍晚」
- **待定 + 可选**：屋顶酒吧同时有「待定」角标和虚线左边条

### Day 2 · 火车与民宿

- **全天事件**：周游券 `allday` + 事务透明底
- **火车票**：浪漫特快，票价已填（金色）
- **自驾类别 + 租车模块**：提车卡（`category: drive`）上挂 `trip-rentals` 区间，**异地还车**（箱根汤本取 / 小田原还），预算钉在模块右上角
- **多条注意**：大涌谷两条 —— 同框数字序号
- **可选费用**：黑蛋「（可选）」→ 预算归可选档
- **民宿模块全满**：雪月花五格全填，星级是四颗金星
- **最小卡片**：会席晚餐无地点无费用

### Day 3 · 高铁与例外

- **高铁换乘**：名古屋停 12 分钟（10:19 到 / 10:31 发），同站换乘位置居中在虚线下方；`mode: hsr` 专属图标
- **住/行视图去重**：还车卡在「行」筛选里被折叠，同一辆车只留取车那张
- **下午模糊时段** + **警告注意** + **可选卡**（鸭川）
- **住宿模块半填**：格兰比亚只有平台/星级，其余待填
- **金额识别失败**：先斗町「看店家时价」→ 预算明细「—」不计入

### Day 4 · 巴士轮渡与返程

- **上午模糊时段**（六曜社）
- **异地经停**：巴士在大阪梅田下客（阪急三番街）、换到新阪急酒店前再出发 —— 两个位置分列虚线两端下方
- **巴士票**、**轮渡票**：不同交通方式的槽位文案（客运·班次 / 船司·班次、座位/舱位）
- **待订角标**：神户牛只挂 flag 不写 booking 块
- **东行同日到达**：UA34 起飞 18:30、同日 11:10 落地，右端日期不变
