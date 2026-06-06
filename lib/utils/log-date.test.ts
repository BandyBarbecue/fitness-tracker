import { describe, it, expect } from 'vitest'
import { isValidLogDate, isFutureLogDate, adjacentLogDate, logDateLabel } from './log-date'

describe('isValidLogDate', () => {
  it('accepts a well-formed date string', () => {
    expect(isValidLogDate('2026-06-05')).toBe(true)
  })

  it('rejects a non-date string', () => {
    expect(isValidLogDate('not-a-date')).toBe(false)
  })

  it('rejects an impossible calendar date', () => {
    expect(isValidLogDate('2026-02-30')).toBe(false)
  })

  it('rejects a string in the wrong format', () => {
    expect(isValidLogDate('2026-6-5')).toBe(false)
  })
})

describe('isFutureLogDate', () => {
  it('returns true for a date after today', () => {
    expect(isFutureLogDate('2026-06-07', '2026-06-06')).toBe(true)
  })

  it('returns false for today', () => {
    expect(isFutureLogDate('2026-06-06', '2026-06-06')).toBe(false)
  })

  it('returns false for a date before today', () => {
    expect(isFutureLogDate('2026-06-05', '2026-06-06')).toBe(false)
  })
})

describe('adjacentLogDate', () => {
  it('returns the next day', () => {
    expect(adjacentLogDate('2026-06-05', 1)).toBe('2026-06-06')
  })

  it('returns the previous day', () => {
    expect(adjacentLogDate('2026-06-05', -1)).toBe('2026-06-04')
  })

  it('rolls over to the next month', () => {
    expect(adjacentLogDate('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('rolls over to the previous year', () => {
    expect(adjacentLogDate('2026-01-01', -1)).toBe('2025-12-31')
  })
})

describe('logDateLabel', () => {
  it('labels today as "Today"', () => {
    expect(logDateLabel('2026-06-06', '2026-06-06')).toBe('Today')
  })

  it('labels yesterday as "Yesterday"', () => {
    expect(logDateLabel('2026-06-05', '2026-06-06')).toBe('Yesterday')
  })

  it('formats other dates as "EEE, d MMM"', () => {
    expect(logDateLabel('2026-06-01', '2026-06-06')).toBe('Mon, 1 Jun')
  })
})
