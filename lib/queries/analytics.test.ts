import { describe, it, expect } from 'vitest'
import {
  periodBounds, previousPeriodBounds,
  avgOf, hitRate, trendArrow, sparklineValues,
} from './analytics'

describe('periodBounds', () => {
  it('returns correct 7-day window', () => {
    expect(periodBounds(7, '2026-06-07')).toEqual({ startDate: '2026-06-01', endDate: '2026-06-07' })
  })
  it('returns correct 30-day window', () => {
    expect(periodBounds(30, '2026-06-07')).toEqual({ startDate: '2026-05-09', endDate: '2026-06-07' })
  })
  it('returns correct 90-day window', () => {
    expect(periodBounds(90, '2026-06-07')).toEqual({ startDate: '2026-03-10', endDate: '2026-06-07' })
  })
})

describe('previousPeriodBounds', () => {
  it('returns the 7-day window immediately before the current one', () => {
    expect(previousPeriodBounds(7, '2026-06-07')).toEqual({ startDate: '2026-05-25', endDate: '2026-05-31' })
  })
  it('returns the 30-day window immediately before the current one', () => {
    expect(previousPeriodBounds(30, '2026-06-07')).toEqual({ startDate: '2026-04-09', endDate: '2026-05-08' })
  })
})

describe('avgOf', () => {
  it('averages non-null values', () => {
    expect(avgOf([1, 2, 3])).toBe(2)
  })
  it('ignores null values', () => {
    expect(avgOf([1, null, 3])).toBe(2)
  })
  it('returns null for empty array', () => {
    expect(avgOf([])).toBeNull()
  })
  it('returns null when all values are null', () => {
    expect(avgOf([null, null])).toBeNull()
  })
  it('rounds to one decimal place', () => {
    expect(avgOf([1, 2])).toBe(1.5)
    expect(avgOf([7.5, 6.0, 8.0])).toBe(7.2)
  })
})

describe('hitRate', () => {
  it('returns correct percentage of logged values meeting target', () => {
    expect(hitRate([8, null, 12], 10)).toBe(50)
  })
  it('returns 0 when no logged values', () => {
    expect(hitRate([null, null], 10)).toBe(0)
  })
  it('returns 100 when all values meet target', () => {
    expect(hitRate([10, 11, 12], 10)).toBe(100)
  })
  it('returns 0 when no values meet target', () => {
    expect(hitRate([1, 2, 3], 10)).toBe(0)
  })
})

describe('trendArrow', () => {
  it('returns → for flat data', () => {
    expect(trendArrow([2, 2, 2, 2])).toBe('→')
  })
  it('returns ↑ when second half average exceeds first half', () => {
    expect(trendArrow([1, 1, 2, 2])).toBe('↑')
  })
  it('returns ↓ when second half average is below first half', () => {
    expect(trendArrow([2, 2, 1, 1])).toBe('↓')
  })
  it('returns → for single value', () => {
    expect(trendArrow([5])).toBe('→')
  })
  it('ignores null values', () => {
    expect(trendArrow([1, null, 2, 2])).toBe('↑')
  })
})

describe('sparklineValues', () => {
  it('returns last N values', () => {
    expect(sparklineValues([1, 2, 3, 4, 5, 6, 7, 8, 9], 7)).toEqual([3, 4, 5, 6, 7, 8, 9])
  })
  it('returns all values when fewer than N', () => {
    expect(sparklineValues([1, 2, 3], 7)).toEqual([1, 2, 3])
  })
  it('maps null to null', () => {
    expect(sparklineValues([1, null, 3], 7)).toEqual([1, null, 3])
  })
})
