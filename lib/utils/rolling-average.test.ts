import { describe, it, expect } from 'vitest'
import { rollingAverage } from './rolling-average'

describe('rollingAverage', () => {
  it('returns empty array for empty input', () => {
    expect(rollingAverage([])).toEqual([])
  })

  it('returns the single point for a single data point', () => {
    const result = rollingAverage([{ date: '2026-01-01', weight_kg: 80 }])
    expect(result).toEqual([{ date: '2026-01-01', average: 80 }])
  })

  it('uses partial window at the start of the series', () => {
    const data = [
      { date: '2026-01-01', weight_kg: 80 },
      { date: '2026-01-02', weight_kg: 86 },
    ]
    const result = rollingAverage(data, 7)
    expect(result[0].average).toBe(80)   // window of 1
    expect(result[1].average).toBe(83)   // window of 2: (80+86)/2
  })

  it('calculates a full window correctly', () => {
    const data = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      weight_kg: 80 + i, // 80,81,82,83,84,85,86
    }))
    const result = rollingAverage(data, 7)
    expect(result[6].average).toBe(83) // (80+81+82+83+84+85+86)/7 = 83
  })

  it('rounds to one decimal place', () => {
    const data = [
      { date: '2026-01-01', weight_kg: 80.1 },
      { date: '2026-01-02', weight_kg: 80.2 },
      { date: '2026-01-03', weight_kg: 80.3 },
    ]
    const result = rollingAverage(data, 3)
    expect(result[2].average).toBe(80.2)
  })
})
