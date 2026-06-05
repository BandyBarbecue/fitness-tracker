interface Targets {
  calories: number; protein_g: number; fat_g: number; carbs_g: number
  steps: number; goal_rate_kg_per_week: number
  bodyweight_kg: number; height_cm: number; training_split: string
}

interface LogRow {
  date: string; weight_kg: number | null
  calories: number | null; protein_g: number | null
  fat_g: number | null; carbs_g: number | null
  steps: number | null; session_type: string | null
}

export function buildCheckinPrompt(targets: Targets, logs: LogRow[]): string {
  const proteinHits = logs.filter(l => l.protein_g != null && l.protein_g >= targets.protein_g).length
  const proteinHitRate = logs.length > 0 ? Math.round((proteinHits / logs.length) * 100) : 0

  const weightLogs = logs.filter(l => l.weight_kg != null).map(l => l.weight_kg!)
  const recentAvg = weightLogs.length > 0
    ? weightLogs.slice(0, Math.min(7, weightLogs.length)).reduce((a, b) => a + b, 0) / Math.min(7, weightLogs.length)
    : targets.bodyweight_kg
  const olderWeights = weightLogs.slice(7)
  const olderAvg = olderWeights.length > 0
    ? olderWeights.reduce((a, b) => a + b, 0) / olderWeights.length
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

  return `You are a personal fitness coach. Your client's current profile:
- Height: ${targets.height_cm}cm, Weight goal base: ${targets.bodyweight_kg}kg
- Programme: ${targets.training_split}
- Daily targets: ${targets.calories} kcal, ${targets.protein_g}g protein, ${targets.fat_g}g fat, ${targets.carbs_g}g carbs, ${targets.steps} steps
- Fat-loss goal: ${targets.goal_rate_kg_per_week} kg/week

Data for the last ${logs.length} logged days:
${table}

Computed stats:
- Recent avg weight: ${Math.round(recentAvg * 10) / 10} kg (7-day trend: ${trendDir}, ${weeklyDelta > 0 ? '+' : ''}${weeklyDelta} kg)
- Protein target hit rate: ${proteinHitRate}% of logged days
- Days logged: ${logs.length}

Write a concise coaching summary in 3–5 short paragraphs. Cover: weight trend vs goal rate, protein adherence, what's going well, one specific actionable focus for this week. Be direct. No bullet points. No sign-off.`
}
