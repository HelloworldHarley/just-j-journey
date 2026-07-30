import { z } from 'zod'
import { CATEGORY_KEYS, FLAG_KEYS } from './categories.ts'
import { FlightSchema } from './trip.ts'

/**
 * TripPatch —— 修改行程的唯一入口。
 *
 * UI 编辑模式（保存时批量提交）和未来的 chat agent（propose_patch 工具）
 * 都只能发出这里定义的操作。应用逻辑在 @jjj/tripmd 的 applyPatch：
 * 结构化应用 → serialize → re-parse，让解析器成为唯一校验器 ——
 * 手动编辑、agent 修改与文件导入享受完全相同的语义检查。
 *
 * 五种操作都已实现并有测试；当前 UI 只用前两种，后三种是给
 * 「添加/删除/移动行程」和 agent 预留的接口 —— 预留的是无 UI，不是无代码。
 */

/** 传 null 表示清除该字段；不传表示不动 */
export const UpdateEventFieldsSchema = z
  .object({
    title: z.string().min(1).optional(),
    /** 作者格式时间："18:25–18:55" / "13:11" / "afternoon" */
    timeRaw: z.string().min(1).optional(),
    /** 费用原文（自然语言，金额由解析器抽取）；null 清除 */
    costRaw: z.string().nullable().optional(),
    /** 地点名（不存在则自动建档）；null 摘掉地点 */
    placeName: z.string().nullable().optional(),
    category: z.enum(CATEGORY_KEYS).optional(),
    summary: z.string().optional(),
  })
  .strict()

export const NewEventSchema = z
  .object({
    title: z.string().min(1),
    category: z.enum(CATEGORY_KEYS),
    timeRaw: z.string().min(1),
    placeName: z.string().optional(),
    costRaw: z.string().optional(),
    flags: z.array(z.enum(FLAG_KEYS)).default([]),
    summary: z.string().default(''),
  })
  .strict()

export const TripPatchOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('set_flight'), eventId: z.string().min(1), flight: FlightSchema }),
  z.object({
    op: z.literal('update_event'),
    eventId: z.string().min(1),
    fields: UpdateEventFieldsSchema,
  }),
  z.object({
    op: z.literal('add_event'),
    dayIndex: z.number().int().positive(),
    /** null = 插到当天最前 */
    afterEventId: z.string().nullable(),
    event: NewEventSchema,
  }),
  z.object({ op: z.literal('remove_event'), eventId: z.string().min(1) }),
  z.object({
    op: z.literal('move_event'),
    eventId: z.string().min(1),
    dayIndex: z.number().int().positive(),
    afterEventId: z.string().nullable(),
  }),
])

export type TripPatchOp = z.infer<typeof TripPatchOpSchema>
export type UpdateEventFields = z.infer<typeof UpdateEventFieldsSchema>
export type NewEvent = z.infer<typeof NewEventSchema>
