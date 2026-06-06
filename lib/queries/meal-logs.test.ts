import { describe, it, expect } from 'vitest'
import { sumMealMacros } from './meal-logs'

describe('sumMealMacros', () => {
  it('sums macros across multiple meals', () => {
    const meals = [
      { calories: 400, protein_g: 30, fat_g: 12, carbs_g: 40 },
      { calories: 800, protein_g: 60, fat_g: 30, carbs_g: 70 },
    ]
    expect(sumMealMacros(meals)).toEqual({ calories: 1200, protein_g: 90, fat_g: 42, carbs_g: 110 })
  })

  it('treats null macro fields as zero', () => {
    const meals = [
      { calories: 400, protein_g: null, fat_g: 12, carbs_g: null },
      { calories: null, protein_g: 60, fat_g: null, carbs_g: 70 },
    ]
    expect(sumMealMacros(meals)).toEqual({ calories: 400, protein_g: 60, fat_g: 12, carbs_g: 70 })
  })

  it('returns all zeros for an empty list', () => {
    expect(sumMealMacros([])).toEqual({ calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 })
  })
})
