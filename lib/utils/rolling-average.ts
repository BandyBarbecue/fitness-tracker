export function rollingAverage(
  data: Array<{ date: string; weight_kg: number }>,
  windowDays = 7
): Array<{ date: string; average: number }> {
  return data.map((point, index) => {
    const start = Math.max(0, index - windowDays + 1)
    const window = data.slice(start, index + 1)
    const avg = window.reduce((sum, p) => sum + p.weight_kg, 0) / window.length
    return { date: point.date, average: Math.round(avg * 10) / 10 }
  })
}
