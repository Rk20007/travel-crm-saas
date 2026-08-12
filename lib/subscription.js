/**
 * Agency subscription-expiry helpers. An agency gets 1 calendar month of
 * access at a time — set on creation, pushed forward by the super admin's
 * "Renew" action, and enforced at login / token refresh / a daily cron.
 */

/** Adds one calendar month to `from` (defaults to now) — e.g. 11 Aug → 11 Sep.
 * If the target month is shorter (e.g. 31 Jan → Feb), JS Date clamps to the
 * last valid day of that month rather than overflowing into March. */
export function addOneMonth(from = new Date()) {
  const d = new Date(from)
  d.setMonth(d.getMonth() + 1)
  return d
}

/** True once `subscriptionExpiresAt` has passed. A team with no expiry set
 * (legacy/manually-created records) is treated as never expiring. */
export function isSubscriptionExpired(team) {
  return Boolean(team?.subscriptionExpiresAt && new Date(team.subscriptionExpiresAt) <= new Date())
}
