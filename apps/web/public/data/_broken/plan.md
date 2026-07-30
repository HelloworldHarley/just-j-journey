---
id: broken-fixture
title: 故意写坏的样本
destination: Seattle, WA, USA
timezone: America/Los_Angeles
start: 2026-10-01
end: 2026-10-03
---

# 故意写坏的样本 · 用来检验报错质量

## 地点表

```trip-places
- name: Space Needle
  coord: 47.6205, -122.3493
  category: sight
- name: Pike Place Market
  coord: 47.6097, -122.3422
  category: food
- name: Kerry Park
  coord: 47.6295, 122.3599
  category: viewpoint
- name: Gas Works Park
  coord: 47.6456, -122.3344
  category: outdoor
```

## Day 1 · 2026-10-01

```trip-day
theme: 检验报错
```

### 缺 category

```trip-event
time: 09:00–10:00
place: Space Needle
```

这个事件没写 category。

### 类别拼错了

```trip-event
time: 11:00–12:00
category: sightseing
place: Pike Place Market
```

sightseeing 少了一个 e，而且它本身也不是规范枚举值。

### 时间格式不对

```trip-event
time: 下午三点半
category: sight
place: Kerry Park
```

时间写成了自然语言。

### 地点没声明

```trip-event
time: 16:00–17:00
category: viewpoint
place: Kery Park
```

Kerry 少了一个 r。

## Day 4 · 2026-10-09

```trip-day
theme: 日期跑到行程区间之外
```

### 越界的一天

```trip-event
time: 10:00
category: sight
place: Gas Works Park
to_next: {mode: teleport, minutes: 1}
```

这一天的日期不在 start~end 内，而且交通方式是瞎编的。
