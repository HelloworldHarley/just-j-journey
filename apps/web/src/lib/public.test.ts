import { describe, expect, it } from 'vitest'
import { shownTerms, showsField } from './public.ts'

const terms = [
  { label: '客舱', value: '经济舱' },
  { label: '托运', value: undefined },
  { label: '退改', value: '' },
]

describe('showsField', () => {
  it('有值总画；没值（undefined / 空串）只在完整版画', () => {
    expect(showsField('x', true)).toBe(true)
    expect(showsField('x', false)).toBe(true)
    expect(showsField(undefined, true)).toBe(true)
    expect(showsField(undefined, false)).toBe(false)
    expect(showsField('', false)).toBe(false)
  })
})

describe('shownTerms', () => {
  it('完整版原样全留（待填槽要画）；公开版只剩有值的', () => {
    expect(shownTerms(terms, true)).toEqual(terms)
    expect(shownTerms(terms, false).map((t) => t.label)).toEqual(['客舱'])
    expect(shownTerms([{ value: undefined }], false)).toEqual([])
  })
})
