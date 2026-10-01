---
id: sanitize-full
title: 抹除测试
destination: Tokyo, Japan
timezone: Asia/Tokyo
start: 2026-11-20
end: 2026-11-22
travelers: 1
currency: JPY
visibility: public
---

# 抹除测试

## 硬约束

```trip-constraints
- kind: depart
  at: 2026-11-22 18:30
  label: 起飞 · UA34
  note: 确认号 ABC123，值机柜台 H 区
```

## 长途

```trip-transports
- what: 去程
  cost: "$900"
  transport: {traveler: 我, mode: flight, carrier: 达美, number: DL7, from: LAX T2, to: HND T3, dep_date: "2026-11-19", dep_time: "08:05", arr_time: "15:30", arr_day_offset: 1, duration: 14h25m, cabin: 经济舱, seat: 36C, baggage: 2 件 · 直挂, refund: 改签 $200 起, price: "$842", stops: [{airport: SEA, arr_time: "10:55", dep_time: "13:35", leg: 2h50m, wait: 2h40m}], legs: [{number: DL7, seat: 36C}, {number: DL167, seat: 22A}], note: 确认号 ABC123}
- what: 新干线
  cost: "¥11220"
  transport: {mode: hsr, carrier: JR 东海, number: のぞみ 1, from: 东京, to: 京都, dep_time: "09:00", arr_time: "11:15", duration: 2h15m, cabin: 指定席, seat: 5A, price: "¥11,220"}
- what: 返程
  transport: {mode: flight, carrier: 联合, number: UA34, from: HND T3, to: SFO, dep_time: "18:30", arr_time: "11:10", arr_date: 2026-11-22, duration: 9h40m, price: "$715", seat: 40K}
- what: 备用巴士
  transport: {mode: bus, carrier: 某巴士公司, number: X99, from: 东京站, to: 成田机场, dep_time: "07:00", arr_time: "08:30", price: "¥3200"}
```

## 住宿

```trip-stays
- what: 山间小屋
  platform: Airbnb
  from: "2026-11-20 18:00"
  to: "2026-11-22 10:00"
  cost: "$120.00"
  room: 独栋
  parking: 含
  breakfast: 不含
  refund: 11/1 前可免费取消
  note: 自助入住
```

## 租车

```trip-rentals
- what: 日产 Note
  platform: Times Car
  from: "2026-11-20 16:30"
  to: "2026-11-22 12:00"
  cost: "$88.40"
  pickup: 羽田机场
  dropoff: 羽田机场
  mileage: 不限
  refund: 提车前 24 小时可免费取消
```

## 地点表

```trip-places
- name: 羽田机场
  en: Haneda Airport
  coord: 35.5494, 139.7798
  category: flight
- name: 山间小屋
  en: 777 Made Up Road
  coord: 35.65432, 139.12345
  category: homestay
  url: https://example.com/listing/1
  gmaps_place_id: ChIJfakefakefake
  note: 门牌在邮箱后面
- name: 京都站
  coord: 34.9858, 135.7588
  category: transit
```

## Day 1 · 2026-11-20

```trip-day
theme: 落地提车进山
```

今天的主线是把车提到、天黑前进山。

### 落地

```trip-event
time: "15:30"
category: flight
place: 羽田机场
detail: 去程
notes:
  - 确认号 ABC123 在邮件里，过关排队 30 分钟起
to_next: {mode: rail, minutes: 25, label: 到达层走到单轨站约 8 分钟, note: 用 Suica 刷闸机}
```

我先落地，坐单轨去接她 —— 她的航班晚 40 分钟。

#### 备选 · 她的航班晚点

在到达厅的咖啡店等，别出关。

### 提车

```trip-event
time: "16:30"
category: drive
place: 羽田机场
detail: 日产 Note
cost: 停车 ¥500
booking: {status: booked, deadline: 2026-11-01, note: 取车码 R8Q4 在邮件里}
to_next: {mode: drive, minutes: 90}
```

### 入住

```trip-event
time: "18:00"
category: homestay
place: 山间小屋
detail: 山间小屋
```

## Day 2 · 2026-11-21

```trip-day
from_stay: {mode: drive, minutes: 30}
```

### 新干线去京都

```trip-event
time: 09:00–11:15
category: hsr
place: 京都站
flags: [needs-booking, optional]
detail: 新干线
```

指定席选右侧，过静冈那段能看到富士山。

## Day 3 · 2026-11-22

```trip-day
from_stay: {mode: drive, minutes: 90, label: 下山直奔机场还车点, note: 17 点前还车，油要加满}
```

### 起飞

```trip-event
time: "18:30"
category: flight
place: 羽田机场
detail: 返程
```

她经香港转机回上海，我直飞。

## 附录 · 打包清单

```trip-ref
id: packing
```

- 好走的鞋
- 充电线
