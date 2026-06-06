import { addDays, format, isValid, parseISO } from 'date-fns'

/** Validates a 'yyyy-MM-dd' string is both correctly formatted and a real calendar date. */
export function isValidLogDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = parseISO(date)
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === date
}

/** ISO 'yyyy-MM-dd' strings sort lexicographically in chronological order. */
export function isFutureLogDate(date: string, today: string): boolean {
  return date > today
}

export function adjacentLogDate(date: string, direction: -1 | 1): string {
  return format(addDays(parseISO(date), direction), 'yyyy-MM-dd')
}

export function logDateLabel(date: string, today: string): string {
  if (date === today) return 'Today'
  if (date === adjacentLogDate(today, -1)) return 'Yesterday'
  return format(parseISO(date), 'EEE, d MMM')
}
