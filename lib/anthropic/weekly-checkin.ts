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
}

export interface MealLogRow {
  date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  calories: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
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

  const table = [
    'date       | weight | kcal | prot | fat | carbs | steps | session',
    '-----------|--------|------|------|-----|-------|-------|--------',
    ...logs.map(l =>
      `${l.date} | ${l.weight_kg ?? '—'} | ${l.calories ?? '—'} | ${l.protein_g ?? '—'} | ${l.fat_g ?? '—'} | ${l.carbs_g ?? '—'} | ${l.steps ?? '—'} | ${l.session_type ?? '—'}`
    ),
  ].join('\n')

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

Data for the last ${logs.length} logged days:
${table}

Computed stats:
- Recent avg weight: ${Math.round(recentAvg * 10) / 10} kg (7-day trend: ${trendDir}, ${weeklyDelta > 0 ? '+' : ''}${weeklyDelta} kg)
- Protein target hit rate: ${proteinHitRate}% of logged days
- Days logged: ${logs.length}${mealDistributionBlock}

Write a concise coaching summary in 3–5 short paragraphs. Cover: weight trend vs goal rate, protein adherence${coverageNote}, what's going well, one specific actionable focus for this week. Be direct. No bullet points. No sign-off.`
}
