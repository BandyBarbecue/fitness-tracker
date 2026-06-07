interface Targets {
  calories: number; protein_g: number; fat_g: number; carbs_g: number
  steps: number; goal_rate_kg_per_week: number
  bodyweight_kg: number; height_cm: number; training_split: string | null
}

interface LogRow {
  date: string; weight_kg: number | null
  calories: number | null; protein_g: number | null
  fat_g: number | null; carbs_g: number | null
  steps: number | null; session_type: string | null
  sleep_hours: number | null; mood: number | null
  water_l: number | null; note: string | null
}

export interface MealLogRow {
  date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  calories: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  note: string | null
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
const MEAL_LABELS: Record<typeof MEAL_TYPES[number], string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks',
}

function buildMealDistributionSection(mealLogs: MealLogRow[]): string | null {
  if (mealLogs.length === 0) return null

  const daysWithMeals = new Set(mealLogs.map(m => m.date)).size

  const rows = MEAL_TYPES
    .map(type => {
      const entries = mealLogs.filter(m => m.meal_type === type)
      if (entries.length === 0) return null
      return {
        type,
        avgCalories: Math.round(entries.reduce((sum, m) => sum + (m.calories ?? 0), 0) / daysWithMeals),
        avgProtein: Math.round(entries.reduce((sum, m) => sum + (m.protein_g ?? 0), 0) / daysWithMeals),
      }
    })
    .filter((r): r is { type: typeof MEAL_TYPES[number]; avgCalories: number; avgProtein: number } => r != null)

  if (rows.length === 0) return null

  const totalAvgCalories = rows.reduce((sum, r) => sum + r.avgCalories, 0)

  const lines = rows.map(r => {
    const pct = totalAvgCalories > 0 ? Math.round((r.avgCalories / totalAvgCalories) * 100) : 0
    return `- ${MEAL_LABELS[r.type]}: ${r.avgCalories} kcal (${pct}%), ${r.avgProtein}g protein`
  })

  return [`Meal distribution (avg across ${daysWithMeals} days with per-meal logs):`, ...lines].join('\n')
}

export function buildCheckinPrompt(targets: Targets, logs: LogRow[], mealLogs: MealLogRow[] = []): string {
  const proteinLogged = logs.filter(l => l.protein_g != null)
  const proteinHits = proteinLogged.filter(l => l.protein_g! >= targets.protein_g).length
  const proteinHitRate = proteinLogged.length > 0
    ? Math.round((proteinHits / proteinLogged.length) * 100)
    : 0

  const weightLogs = logs.filter(l => l.weight_kg != null).map(l => l.weight_kg!)
  const sortedWeights = [...weightLogs].reverse() // newest first
  const recentSlice = sortedWeights.slice(0, Math.min(7, sortedWeights.length))
  const olderSlice = sortedWeights.slice(7)
  const recentAvg = recentSlice.length > 0
    ? recentSlice.reduce((a, b) => a + b, 0) / recentSlice.length
    : targets.bodyweight_kg
  const olderAvg = olderSlice.length > 0
    ? olderSlice.reduce((a, b) => a + b, 0) / olderSlice.length
    : recentSlice.length > 1
      ? recentSlice[recentSlice.length - 1] // oldest in window (index is highest = oldest because newest-first)
      : recentAvg
  const weeklyDelta = Math.round((recentAvg - olderAvg) * 100) / 100
  const trendDir = weeklyDelta < 0 ? 'down' : weeklyDelta > 0 ? 'up' : 'flat'

  const sleepLogged = logs.filter(l => l.sleep_hours != null)
  const avgSleep = sleepLogged.length > 0
    ? Math.round(sleepLogged.reduce((s, l) => s + l.sleep_hours!, 0) / sleepLogged.length * 10) / 10
    : null

  const moodLogged = logs.filter(l => l.mood != null)
  const avgMood = moodLogged.length > 0
    ? Math.round(moodLogged.reduce((s, l) => s + l.mood!, 0) / moodLogged.length * 10) / 10
    : null

  const waterLogged = logs.filter(l => l.water_l != null)
  const avgWater = waterLogged.length > 0
    ? Math.round(waterLogged.reduce((s, l) => s + l.water_l!, 0) / waterLogged.length * 10) / 10
    : null

  const stepsLoggedRows = logs.filter(l => l.steps != null)
  const stepsHits = stepsLoggedRows.filter(l => l.steps! >= targets.steps).length
  const stepsHitRate = stepsLoggedRows.length > 0
    ? Math.round(stepsHits / stepsLoggedRows.length * 100)
    : 0

  const SESSION_LABELS_SHORT: Record<string, string> = {
    push: 'Push', pull: 'Pull', legs: 'Legs', upper: 'Upper', rest: 'Rest', cardio: 'Cardio',
  }
  const sessionCounts: Record<string, number> = {}
  for (const l of logs) {
    if (l.session_type) sessionCounts[l.session_type] = (sessionCounts[l.session_type] ?? 0) + 1
  }
  const sessionBreakdown = Object.entries(sessionCounts)
    .map(([t, n]) => `${SESSION_LABELS_SHORT[t] ?? t} ×${n}`)
    .join(', ') || 'none logged'

  const table = [
    'date       | weight | kcal | prot | fat | carbs | steps | sleep | mood | water | session',
    '-----------|--------|------|------|-----|-------|-------|-------|------|-------|--------',
    ...logs.map(l =>
      `${l.date} | ${l.weight_kg ?? '—'} | ${l.calories ?? '—'} | ${l.protein_g ?? '—'} | ${l.fat_g ?? '—'} | ${l.carbs_g ?? '—'} | ${l.steps ?? '—'} | ${l.sleep_hours ?? '—'} | ${l.mood ?? '—'} | ${l.water_l ?? '—'} | ${l.session_type ?? '—'}`
    ),
  ].join('\n')

  const dailyNotes = logs.filter(l => l.note)
  const dailyNotesBlock = dailyNotes.length > 0
    ? `\n\nDaily notes:\n${dailyNotes.map(l => `- ${l.date}: ${l.note}`).join('\n')}`
    : ''

  const mealNotes = mealLogs.filter(m => m.note)
  const mealNotesBlock = mealNotes.length > 0
    ? `\n\nMeal notes:\n${mealNotes.map(m => `- ${m.date} (${MEAL_LABELS[m.meal_type]}): ${m.note}`).join('\n')}`
    : ''

  const mealDistribution = buildMealDistributionSection(mealLogs)
  const mealDistributionBlock = mealDistribution ? `\n\n${mealDistribution}` : ''
  const coverageNote = mealDistribution
    ? ', how protein and calories are distributed across meals and whether that supports training and recovery'
    : ''

  return `You are a personal fitness coach. Your client's current profile:
- Height: ${targets.height_cm}cm, Weight goal base: ${targets.bodyweight_kg}kg
- Programme: ${targets.training_split ?? 'Not set'}
- Daily targets: ${targets.calories} kcal, ${targets.protein_g}g protein, ${targets.fat_g}g fat, ${targets.carbs_g}g carbs, ${targets.steps} steps
- Fat-loss goal: ${targets.goal_rate_kg_per_week} kg/week

Data for the last ${logs.length} logged days (sleep in hours, mood on a 1–5 scale, water in litres):
${table}${dailyNotesBlock}${mealNotesBlock}

Computed stats:
- Recent avg weight: ${Math.round(recentAvg * 10) / 10} kg (7-day trend: ${trendDir}, ${weeklyDelta > 0 ? '+' : ''}${weeklyDelta} kg)
- Protein target hit rate: ${proteinHitRate}% of logged days
- Steps target hit rate: ${stepsHitRate}% of logged days
- Avg sleep: ${avgSleep != null ? `${avgSleep} hr` : 'not logged'}
- Avg mood: ${avgMood != null ? `${avgMood}/5` : 'not logged'}
- Avg water: ${avgWater != null ? `${avgWater} L` : 'not logged'}
- Sessions: ${sessionBreakdown}
- Days logged: ${logs.length}${mealDistributionBlock}

Write a concise coaching summary in 3–5 short paragraphs. Cover: weight trend vs goal rate, protein adherence${coverageNote}, sleep quality and trends, mood patterns, hydration, and training frequency — and whether any of these correlate with weight or energy patterns in the data, what's going well, one specific actionable focus for this week. Be direct. No bullet points. No sign-off.`
}
