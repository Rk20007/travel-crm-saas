import { differenceInCalendarDays, format } from 'date-fns'
import crypto from 'crypto'

export function getDurationDays(startDate, endDate) {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  return Math.max(1, differenceInCalendarDays(end, start) + 1)
}

export function formatItineraryDate(date) {
  if (!date) return '—'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return format(d, 'MMM d, yyyy')
}

export function generateShareToken() {
  return crypto.randomBytes(16).toString('hex')
}

export function getStatusColor(status) {
  const map = {
    draft: 'bg-slate-100 text-slate-700 border-slate-200',
    sent: 'bg-blue-100 text-blue-700 border-blue-200',
    approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
    published: 'bg-violet-100 text-violet-700 border-violet-200',
  }
  return map[status] || map.draft
}

export function getDefaultBanner(destination) {
  const q = encodeURIComponent(destination || 'travel destination')
  return `https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&h=400&fit=crop&q=80&auto=format&dpr=2&${q}`
}

export function normalizeItineraryForClient(doc) {
  if (!doc) return null
  const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc }
  o.tripName = o.tripName || o.title
  o.pricePerPerson = o.pricePerPerson ?? o.perPersonCost ?? 0
  o.totalPrice = o.totalPrice ?? o.totalCost ?? 0
  o.durationDays = getDurationDays(o.startDate, o.endDate)
  return o
}
