/** Plan limits for SaaS gating (extend as you add features) */
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

export function getPlanLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.basic
}
