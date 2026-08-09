import Plan from '@/models/Plan'

/** Numeric limits are capped; boolean limits are feature flags. */
export const LIMIT_KEYS = [
  'maxBrands',
  'maxAgents',
  'maxLeadsPerMonth',
  'automation',
  'whatsappAutomation',
  'apiIngest',
]

export const BOOLEAN_LIMIT_KEYS = ['automation', 'whatsappAutomation', 'apiIngest']

/**
 * Fallback plan limits. These seed the Plan collection on first use and remain
 * the answer if the DB has no matching plan — so gating never fails open.
 */
export const PLAN_LIMITS = {
  basic: {
    maxBrands: 1,
    maxAgents: 3,
    maxLeadsPerMonth: 500,
    automation: false,
    whatsappAutomation: false,
    apiIngest: false,
  },
  standard: {
    maxBrands: 3,
    maxAgents: 15,
    maxLeadsPerMonth: 5000,
    automation: true,
    whatsappAutomation: true,
    apiIngest: true,
  },
  premium: {
    maxBrands: 25,
    maxAgents: 200,
    maxLeadsPerMonth: 100000,
    automation: true,
    whatsappAutomation: true,
    apiIngest: true,
  },
}

const PLAN_SEED_META = {
  basic: { name: 'Basic', priceMonthly: 0, sortOrder: 1 },
  standard: { name: 'Standard', priceMonthly: 2999, sortOrder: 2 },
  premium: { name: 'Premium', priceMonthly: 9999, sortOrder: 3 },
}

/** Synchronous fallback — code defaults only. Prefer resolveTeamLimits(). */
export function getPlanLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.basic
}

/**
 * Coerce an arbitrary object into a valid limits patch, dropping unknown keys
 * and anything that isn't the right type. Used for both plan edits and
 * per-agency overrides, so client payloads can never inject junk fields.
 */
export function sanitizeLimits(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const key of LIMIT_KEYS) {
    const value = raw[key]
    if (value === undefined || value === null || value === '') continue
    if (BOOLEAN_LIMIT_KEYS.includes(key)) {
      out[key] = Boolean(value)
    } else {
      const n = Number(value)
      if (Number.isFinite(n) && n >= 0) out[key] = Math.floor(n)
    }
  }
  return out
}

/** Create any missing default plans. Idempotent — safe to call on every request. */
export async function seedDefaultPlans() {
  const existing = await Plan.find({}).select('key').lean()
  const have = new Set(existing.map((p) => p.key))
  const missing = Object.keys(PLAN_LIMITS).filter((key) => !have.has(key))
  if (!missing.length) return 0

  await Plan.insertMany(
    missing.map((key) => ({
      key,
      name: PLAN_SEED_META[key]?.name || key,
      priceMonthly: PLAN_SEED_META[key]?.priceMonthly ?? 0,
      sortOrder: PLAN_SEED_META[key]?.sortOrder ?? 99,
      limits: { ...PLAN_LIMITS[key] },
      isActive: true,
    })),
    { ordered: false }
  ).catch(() => {
    // A concurrent request may have seeded the same keys; the unique index
    // rejects the duplicates and the rest still land.
  })
  return missing.length
}

/**
 * Effective limits for an agency: plan defaults from the DB (falling back to
 * code defaults), with any per-agency override layered on top.
 *
 * @param {object} team - Team document or lean object
 */
export async function resolveTeamLimits(team) {
  const planKey = team?.plan || 'basic'
  let base = PLAN_LIMITS[planKey] || PLAN_LIMITS.basic

  try {
    const doc = await Plan.findOne({ key: planKey }).select('limits').lean()
    if (doc?.limits) {
      // Merge over the code default so a plan missing a newly-added limit key
      // still resolves to something sane instead of undefined.
      base = { ...base, ...sanitizeLimits(doc.limits) }
    }
  } catch {
    // DB unavailable — fall through to code defaults rather than blocking.
  }

  const overrides = sanitizeLimits(team?.planOverrides)
  return { ...base, ...overrides }
}
