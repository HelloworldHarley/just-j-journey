---
id: example-kyoto-2days
title: 京都 2 天 1 夜
subtitle: 最小示例 · 用来说明 TripMD 的每一种块
destination: Kyoto, Japan
timezone: Asia/Tokyo
start: 2026-11-14
end: 2026-11-15
travelers: 2
currency: JPY
---

# 京都 2 天 1 夜

## 硬约束

```trip-constraints
- kind: arrive
  at: 2026-11-14 09:20
  label: 抵达关西机场
  note: 出关后坐 HARUKA 到京都站约 80 分钟
- kind: depart
  at: 2026-11-15 19:05
  label: 关西机场起飞
- kind: deadline
  at: 2026-11-15 16:00
  label: 必须离开京都站
  note: 反推自 19:05 起飞
```

## 地点表

```trip-places
- name: 关西国际机场
  en: Kansai International Airport
  coord: 34.4342, 135.2328
  category: flight
- name: 京都站
  en: Kyoto Station
  coord: 34.9858, 135.7588
  category: transit
- name: 伏见稻荷大社
  en: Fushimi Inari Taisha
  coord: 34.9671, 135.7727
  category: sight
- name: 锦市场
  en: Nishiki Market
  coord: 35.0050, 135.7649
  category: food
- name: 清水寺
  en: Kiyomizu-dera
  coord: 34.9949, 135.7850
  category: sight
- name: 京都四条 UNIZO
  en: Hotel Unizo Kyoto Shijo
  coord: 35.0035, 135.7663
  category: hotel
```

## Day 1 · 2026-11-14

```trip-day
theme: 落地京都，稻荷神社逛到锦市场
sunrise: "06:26"
sunset: "16:52"
lodging: 京都四条 UNIZO
fallback_order: [锦市场, 清水寺夜间参拜]
```

第一天的主线是把时差和行李都安顿好，别排太满。

### 抵达关西机场

```trip-event
time: "09:20"
category: flight
place: 关西国际机场
transport: {mode: flight, carrier: 全日空 ANA, number: NH971 · NH1715, from: PVG T2, to: KIX T1, dep_time: "08:15", arr_time: "09:20", arr_day_offset: 1, duration: 24h05m, baggage: 2 件 23kg, stops: [{airport: HND, wait: 14h30m}]}
to_next: {mode: rail, minutes: 80, label: HARUKA 特急直达京都站}
```

出关后先在机场把 ICOCA 充好值，市内所有交通都能刷。

### 寄存行李

```trip-event
time: 10:50–11:10
category: logistics
place: 京都站
to_next: {mode: rail, minutes: 6, label: 奈良线到稻荷站}
```

京都站中央口的投币寄存柜 11 点前基本都满，**优先去八条口那一侧**。

### 伏见稻荷大社

```trip-event
time: 11:30–14:00
category: sight
place: 伏见稻荷大社
to_next: {mode: rail, minutes: 20}
```

千本鸟居。**走到四辻就可以折返**，再往上是一小时的山路，风景增量有限。

#### 变体 · 人太多

改成傍晚 16:30 之后再来。鸟居区域 24 小时开放且不收费，天黑后打光，人少一半。

### 锦市场晚饭

```trip-event
time: afternoon
category: food
place: 锦市场
cost: 约 ¥3000/人
```

边走边吃。**注意大多数摊位 17:00 前后就收摊**，别拖到太晚。

### 入住 UNIZO

```trip-event
time: "19:30"
category: hotel
place: 京都四条 UNIZO
stay: {platform: Booking, stars: 3, room: 双床房, parking: 不含, breakfast: 不含}
cost: ¥14,000
```

四条河原町的正中心，从锦市场走回来 5 分钟。

## Day 2 · 2026-11-15

```trip-day
theme: 清水寺晨游，午后返程
sunrise: "06:27"
sunset: "16:51"
```

### 清水寺

```trip-event
time: 08:00–10:30
category: sight
place: 清水寺
booking: {status: none}
to_next: {mode: walk, minutes: 25, label: 走二年坂三年坂下山}
```

**8 点前到最好** —— 开门即入，清水舞台上几乎没人。

### 京都站取行李 · 出发

```trip-event
time: "15:30"
category: logistics
place: 京都站
flags: [warning]
notes:
  - "16:00 必须上车。HARUKA 每 30 分钟一班，错过一班就只剩 2.5 小时缓冲"
to_next: {mode: rail, minutes: 80, label: HARUKA 回关西机场}
```

取行李，买点站内便当路上吃。

### 关西机场起飞

```trip-event
time: "19:05"
category: flight
place: 关西国际机场
```

国际航班，17:00 前进航站楼。

## 附录 · 预算

```trip-ref
id: budget
icon: 💰
```

| 项目 | 说明 | 预估（JPY） |
| :-- | :-- | --: |
| 住宿 | UNIZO 四条 1 晚 | ¥14,000 |
| 交通 | HARUKA 往返 + 市内 | ¥8,000 |
| 餐饮 | 2 天 2 人 | ¥18,000 |
| **合计** | | **¥40,000** |

## 附录 · 打包清单

```trip-ref
id: packing
icon: 🎒
```

- 好走的鞋（伏见稻荷是山路）
- ICOCA 或 Apple Pay Suica
- 11 月中旬京都白天 12–17°C，早晚需要外套
