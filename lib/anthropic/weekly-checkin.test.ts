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
    expect(prompt).toContain('86')
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
})
