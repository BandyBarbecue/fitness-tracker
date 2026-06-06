import { describe, it, expect } from 'vitest'
import { buildCheckinPrompt } from './weekly-checkin'

const targets = {
  calories: 2400, protein_g: 185, fat_g: 70, carbs_g: 255,
  steps: 10000, goal_rate_kg_per_week: 0.5,
  bodyweight_kg: 86, height_cm: 188,
  training_split: 'Push/Pull/Legs/Upper',
}

const logs = [
  { date: '2026-05-29', weight_kg: 86.2, calories: 2380, protein_g: 182, fat_g: 68, carbs_g: 252, steps: 9800, session_type: 'push' },
  { date: '2026-05-30', weight_kg: 86.0, calories: 2420, protein_g: 190, fat_g: 71, carbs_g: 258, steps: 11200, session_type: 'pull' },
  { date: '2026-05-31', weight_kg: 85.8, calories: 2300, protein_g: 175, fat_g: 65, carbs_g: 248, steps: 8900, session_type: 'rest' },
]

describe('buildCheckinPrompt', () => {
  it('includes height and weight from targets', () => {
    const prompt = buildCheckinPrompt(targets, logs)
    expect(prompt).toContain('188cm')
    expect(prompt).toContain('86kg')
  })

  it('includes training split', () => {
    const prompt = buildCheckinPrompt(targets, logs)
    expect(prompt).toContain('Push/Pull/Legs/Upper')
  })

  it('includes all log dates in the data table', () => {
    const prompt = buildCheckinPrompt(targets, logs)
    expect(prompt).toContain('2026-05-29')
    expect(prompt).toContain('2026-05-30')
    expect(prompt).toContain('2026-05-31')
  })

  it('calculates protein hit rate correctly', () => {
    // 182 < 185 → miss; 190 >= 185 → hit; 175 < 185 → miss → 1/3 = 33%
    const prompt = buildCheckinPrompt(targets, logs)
    expect(prompt).toContain('33%')
  })

  it('includes goal rate in prompt', () => {
    const prompt = buildCheckinPrompt(targets, logs)
    expect(prompt).toContain('0.5')
  })

  it('identifies downward weight trend', () => {
    const prompt = buildCheckinPrompt(targets, logs)
    expect(prompt).toContain('down')
  })

  it('handles empty logs gracefully', () => {
    const prompt = buildCheckinPrompt(targets, [])
    expect(prompt).not.toMatch(/NaN|undefined/)
    expect(prompt).toContain('0 logged days')
    expect(prompt).toContain('0%')
  })
})

describe('buildCheckinPrompt — meal distribution', () => {
  const mealLogs: Array<{
    date: string
    meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
    calories: number | null
    protein_g: number | null
    fat_g: number | null
    carbs_g: number | null
  }> = [
    { date: '2026-05-29', meal_type: 'breakfast', calories: 400, protein_g: 30, fat_g: 12, carbs_g: 40 },
    { date: '2026-05-29', meal_type: 'dinner', calories: 800, protein_g: 60, fat_g: 30, carbs_g: 70 },
    { date: '2026-05-30', meal_type: 'breakfast', calories: 440, protein_g: 26, fat_g: 14, carbs_g: 44 },
    { date: '2026-05-30', meal_type: 'dinner', calories: 760, protein_g: 56, fat_g: 28, carbs_g: 66 },
  ]

  it('includes a meal distribution section when meal logs are present', () => {
    const prompt = buildCheckinPrompt(targets, logs, mealLogs)
    expect(prompt).toContain('Meal distribution')
  })

  it('omits the meal distribution section when no meal logs are passed', () => {
    const prompt = buildCheckinPrompt(targets, logs)
    expect(prompt).not.toContain('Meal distribution')
  })

  it('computes average calories, percentage share, and average protein per meal type', () => {
    // Breakfast avg: (400+440)/2 = 420 kcal, (30+26)/2 = 28g protein
    // Dinner avg: (800+760)/2 = 780 kcal, (60+56)/2 = 58g protein
    // Total avg calories = 1200 → Breakfast 35%, Dinner 65%
    const prompt = buildCheckinPrompt(targets, logs, mealLogs)
    expect(prompt).toContain('Breakfast: 420 kcal (35%), 28g protein')
    expect(prompt).toContain('Dinner: 780 kcal (65%), 58g protein')
  })

  it('mentions meal distribution in the coaching instructions when present', () => {
    const prompt = buildCheckinPrompt(targets, logs, mealLogs)
    expect(prompt).toContain('how protein and calories are distributed across meals')
  })

  it('does not mention meal distribution in the coaching instructions when absent', () => {
    const prompt = buildCheckinPrompt(targets, logs)
    expect(prompt).not.toContain('how protein and calories are distributed across meals')
  })
})
