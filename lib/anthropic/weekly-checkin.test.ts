import { describe, it, expect } from 'vitest'
import { buildCheckinPrompt } from './weekly-checkin'

const targets = {
  calories: 2400, protein_g: 185, fat_g: 70, carbs_g: 255,
  steps: 10000, goal_rate_kg_per_week: 0.5,
  bodyweight_kg: 86, height_cm: 188,
  training_split: 'Push/Pull/Legs/Upper',
}

const logs = [
  { date: '2026-05-29', weight_kg: 86.2, calories: 2380, protein_g: 182, fat_g: 68, carbs_g: 252, steps: 9800, session_type: 'push', sleep_hours: 7.5, mood: 4, water_l: 2.5, note: 'Felt strong on bench' },
  { date: '2026-05-30', weight_kg: 86.0, calories: 2420, protein_g: 190, fat_g: 71, carbs_g: 258, steps: 11200, session_type: 'pull', sleep_hours: 6, mood: 3, water_l: 1.8, note: null },
  { date: '2026-05-31', weight_kg: 85.8, calories: 2300, protein_g: 175, fat_g: 65, carbs_g: 248, steps: 8900, session_type: 'rest', sleep_hours: 8, mood: 5, water_l: 3.0, note: null },
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

  it('includes sleep, mood, and water in the data table', () => {
    const prompt = buildCheckinPrompt(targets, logs)
    expect(prompt).toContain('sleep | mood | water')
    expect(prompt).toContain('7.5')
    expect(prompt).toContain('| 4 |')
    expect(prompt).toContain('2.5')
  })

  it('includes a daily notes section for days with notes', () => {
    const prompt = buildCheckinPrompt(targets, logs)
    expect(prompt).toContain('Daily notes:')
    expect(prompt).toContain('- 2026-05-29: Felt strong on bench')
    expect(prompt).not.toContain('2026-05-30: null')
  })

  it('omits the daily notes section when no logs have notes', () => {
    const noNotes = logs.map(l => ({ ...l, note: null }))
    const prompt = buildCheckinPrompt(targets, noNotes)
    expect(prompt).not.toContain('Daily notes:')
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
    note: string | null
  }> = [
    { date: '2026-05-29', meal_type: 'breakfast', calories: 400, protein_g: 30, fat_g: 12, carbs_g: 40, note: 'Ate out, estimated' },
    { date: '2026-05-29', meal_type: 'dinner', calories: 800, protein_g: 60, fat_g: 30, carbs_g: 70, note: null },
    { date: '2026-05-30', meal_type: 'breakfast', calories: 440, protein_g: 26, fat_g: 14, carbs_g: 44, note: null },
    { date: '2026-05-30', meal_type: 'dinner', calories: 760, protein_g: 56, fat_g: 28, carbs_g: 66, note: null },
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

  it('includes a meal notes section for meals with notes', () => {
    const prompt = buildCheckinPrompt(targets, logs, mealLogs)
    expect(prompt).toContain('Meal notes:')
    expect(prompt).toContain('- 2026-05-29 (Breakfast): Ate out, estimated')
    expect(prompt).not.toContain('2026-05-29 (Dinner): null')
  })

  it('omits the meal notes section when no meal logs have notes', () => {
    const noNotes = mealLogs.map(m => ({ ...m, note: null }))
    const prompt = buildCheckinPrompt(targets, logs, noNotes)
    expect(prompt).not.toContain('Meal notes:')
  })
})

describe('buildCheckinPrompt — extended stats', () => {
  const extTargets = {
    calories: 2400, protein_g: 185, fat_g: 70, carbs_g: 255,
    steps: 10000, goal_rate_kg_per_week: 0.5,
    bodyweight_kg: 86, height_cm: 188,
    training_split: 'Push/Pull/Legs/Upper',
  }
  const extLogs = [
    { date: '2026-05-29', weight_kg: 86.2, calories: 2380, protein_g: 182, fat_g: 68, carbs_g: 252,
      steps: 9800, session_type: 'push', sleep_hours: 7.5, mood: 4, water_l: 2.5, note: null },
    { date: '2026-05-30', weight_kg: 86.0, calories: 2420, protein_g: 190, fat_g: 71, carbs_g: 258,
      steps: 11200, session_type: 'pull', sleep_hours: 6.0, mood: 3, water_l: 1.8, note: null },
    { date: '2026-05-31', weight_kg: 85.8, calories: 2300, protein_g: 175, fat_g: 65, carbs_g: 248,
      steps: 8900, session_type: 'rest', sleep_hours: 8.0, mood: 5, water_l: 3.0, note: null },
  ]

  it('includes avg sleep in computed stats', () => {
    // (7.5 + 6.0 + 8.0) / 3 = 7.2
    const prompt = buildCheckinPrompt(extTargets, extLogs)
    expect(prompt).toContain('Avg sleep: 7.2 hr')
  })

  it('includes avg mood in computed stats', () => {
    // (4 + 3 + 5) / 3 = 4
    const prompt = buildCheckinPrompt(extTargets, extLogs)
    expect(prompt).toContain('Avg mood: 4/5')
  })

  it('includes avg water in computed stats', () => {
    // (2.5 + 1.8 + 3.0) / 3 = 2.4
    const prompt = buildCheckinPrompt(extTargets, extLogs)
    expect(prompt).toContain('Avg water: 2.4 L')
  })

  it('includes steps hit rate in computed stats', () => {
    // 9800 < 10000 (miss), 11200 >= 10000 (hit), 8900 < 10000 (miss) → 1/3 = 33%
    const prompt = buildCheckinPrompt(extTargets, extLogs)
    expect(prompt).toContain('Steps target hit rate: 33%')
  })

  it('includes session breakdown in computed stats', () => {
    const prompt = buildCheckinPrompt(extTargets, extLogs)
    expect(prompt).toContain('Sessions:')
    expect(prompt).toContain('Push ×1')
    expect(prompt).toContain('Pull ×1')
    expect(prompt).toContain('Rest ×1')
  })

  it('extends coaching instruction to include sleep/mood/hydration/training frequency', () => {
    const prompt = buildCheckinPrompt(extTargets, extLogs)
    expect(prompt).toContain('sleep quality and trends')
    expect(prompt).toContain('mood patterns')
    expect(prompt).toContain('hydration')
    expect(prompt).toContain('training frequency')
  })

  it('handles null sleep/mood/water gracefully', () => {
    const nullLogs = extLogs.map(l => ({ ...l, sleep_hours: null, mood: null, water_l: null }))
    const prompt = buildCheckinPrompt(extTargets, nullLogs)
    expect(prompt).toContain('Avg sleep: not logged')
    expect(prompt).toContain('Avg mood: not logged')
    expect(prompt).toContain('Avg water: not logged')
    expect(prompt).not.toMatch(/NaN|undefined/)
  })
})
