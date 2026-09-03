/**
 * The whole CRM treats its users as being in India (IST, UTC+5:30) — the
 * analytics "today" buckets, the reminder cron, and every date the sales
 * team reads all assume it (see app/api/analytics/sales/route.js). IST has
 * no DST, so a fixed offset is exact.
 *
 * The date/time pickers, though, hand back a bare "YYYY-MM-DDTHH:mm" string
 * with no timezone. When that reaches the API and the production server
 * (which runs in UTC) does `new Date(str)`, the string is read as UTC — so a
 * follow-up a sales person set for "today 9:00 PM" gets stored as 9:00 PM
 * UTC, i.e. 2:30 AM IST the *next* day. It then falls outside both the
 * "Today" and the "Pending/overdue" views and looks like it vanished.
 *
 * Converting the picker value to a real UTC instant *on the client*, pinned
 * to IST, fixes it at the source for every caller.
 */
export function pickerToIso(local) {
  if (!local) return local
  const s = String(local)
  // Already carries a zone (Z or ±HH:MM) — trust it as an absolute instant.
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? local : d.toISOString()
  }
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? local : d.toISOString()
  }
  const [, date, hh, mm, ss = '00'] = m
  const d = new Date(`${date}T${hh}:${mm}:${ss}+05:30`)
  return Number.isNaN(d.getTime()) ? local : d.toISOString()
}
