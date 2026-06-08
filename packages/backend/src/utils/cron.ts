/**
 * Shared cron expression utilities.
 *
 * Supports the standard 5-part cron syntax:
 *   minute  hour  dayOfMonth  month  dayOfWeek
 *   e.g.  "0 9 * * *"       -- 9:00am every day
 *         "* /5 * * * *"    -- every 5 minutes (no space in real usage)
 *         "0 9,18 * * 1"    -- 9am and 6pm every Monday
 */

function matchField(expr: string, value: number): boolean {
  if (expr === '*') return true

  // Step: */n
  if (expr.startsWith('*/')) {
    const step = parseInt(expr.slice(2), 10)
    return !isNaN(step) && step > 0 && value % step === 0
  }

  // Comma-separated list
  if (expr.includes(',')) {
    return expr.split(',').some((part) => matchField(part.trim(), value))
  }

  // Range: a-b
  if (expr.includes('-')) {
    const [a, b] = expr.split('-').map((s) => parseInt(s.trim(), 10))
    return !isNaN(a) && !isNaN(b) && value >= a && value <= b
  }

  // Exact number
  const n = parseInt(expr, 10)
  return !isNaN(n) && n === value
}

/**
 * Returns true if `date` matches the 5-part cron expression.
 * `date` should be timezone-adjusted; UTC getters are used to read local values.
 */
export function matchesCron(expression: string, date: Date): boolean {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) {
    return false
  }
  const [minExpr, hourExpr, domExpr, monExpr, dowExpr] = parts
  return (
    matchField(minExpr, date.getUTCMinutes()) &&
    matchField(hourExpr, date.getUTCHours()) &&
    matchField(domExpr, date.getUTCDate()) &&
    matchField(monExpr, date.getUTCMonth() + 1) &&
    matchField(dowExpr, date.getUTCDay())
  )
}
