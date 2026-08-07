export function leadDisplayName(lead) {
  if (!lead) return 'Unknown'
  if (typeof lead === 'string') return lead
  const name = `${lead.firstName || ''} ${lead.lastName || ''}`.trim()
  return name || lead.name || lead.email || 'Unknown'
}

export function formatInr(amount, currency = 'INR') {
  const n = Number(amount) || 0
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n)
  } catch {
    return `₹${n.toLocaleString('en-IN')}`
  }
}

export const LEAD_STATUSES = [
  'new',
  'contacted',
  'interested',
  'negotiating',
  'booked',
  'completed',
  'lost',
]
