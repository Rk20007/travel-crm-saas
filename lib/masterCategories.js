/**
 * Master category registry — the single source of truth for every configurable
 * dropdown across the CRM. Browser-safe (no Node deps) so it can drive both the
 * Settings UI and dynamic dropdowns everywhere.
 *
 * Each category:
 *   key          machine slug (also SettingOption.category)
 *   label        display name
 *   group        Settings section grouping (Zoho-style)
 *   description   short helper text
 *   supportsColor / supportsIcon   whether the color/icon controls are shown
 *   defaults     seeded options {key,label,color?,icon?,metadata?}
 */

const s = (key, label, color, extra = {}) => ({ key, label, color, ...extra })

export const MASTER_GROUPS = [
  { id: 'leads', label: 'Leads & Sales' },
  { id: 'travel', label: 'Travel & Catalog' },
  { id: 'operations', label: 'Bookings & Operations' },
  { id: 'finance', label: 'Finance' },
  { id: 'organization', label: 'Organization' },
]

export const MASTER_CATEGORIES = [
  // ---------------- Leads & Sales ----------------
  {
    key: 'lead_status',
    label: 'Lead Statuses',
    group: 'leads',
    description: 'Pipeline stages a lead moves through.',
    supportsColor: true,
    supportsIcon: true,
    defaults: [
      s('new', 'New', '#3b82f6'),
      s('contacted', 'Contacted', '#0ea5e9'),
      s('interested', 'Interested', '#8b5cf6'),
      s('negotiating', 'Negotiating', '#f59e0b'),
      s('booked', 'Booked', '#22c55e', { metadata: { isWon: true } }),
      s('completed', 'Completed', '#16a34a', { metadata: { isWon: true } }),
      s('lost', 'Lost', '#ef4444', { metadata: { isLost: true } }),
    ],
  },
  {
    key: 'lost_reason',
    label: 'Lost Reasons',
    group: 'leads',
    description: 'Why a lead was marked as lost.',
    supportsColor: true,
    defaults: [
      s('budget', 'Budget too high', '#ef4444'),
      s('no_response', 'No response', '#f97316'),
      s('booked_competitor', 'Booked with competitor', '#dc2626'),
      s('plan_cancelled', 'Trip cancelled', '#6b7280'),
      s('not_interested', 'Not interested', '#a1a1aa'),
      s('duplicate', 'Duplicate lead', '#94a3b8'),
    ],
  },
  {
    key: 'lead_source',
    label: 'Lead Sources',
    group: 'leads',
    description: 'Where leads originate from.',
    supportsColor: true,
    defaults: [
      s('direct', 'Direct', '#64748b'),
      s('website', 'Website', '#0ea5e9'),
      s('facebook_ads', 'Facebook Ads', '#1877f2'),
      s('instagram', 'Instagram', '#e1306c'),
      s('referral', 'Referral', '#22c55e'),
      s('social', 'Social', '#8b5cf6'),
      s('api', 'API', '#6366f1'),
      s('other', 'Other', '#94a3b8'),
    ],
  },
  {
    key: 'lead_priority',
    label: 'Priorities',
    group: 'leads',
    description: 'Lead / follow-up priority levels.',
    supportsColor: true,
    defaults: [
      s('low', 'Low', '#94a3b8'),
      s('medium', 'Medium', '#3b82f6'),
      s('high', 'High', '#f59e0b'),
      s('urgent', 'Urgent', '#ef4444'),
    ],
  },
  {
    key: 'follow_up_type',
    label: 'Follow-up Types',
    group: 'leads',
    description: 'Channels used to follow up with a lead.',
    supportsColor: true,
    supportsIcon: true,
    defaults: [
      s('call', 'Call', '#0ea5e9'),
      s('email', 'Email', '#8b5cf6'),
      s('whatsapp', 'WhatsApp', '#22c55e'),
      s('meeting', 'Meeting', '#f59e0b'),
      s('site_visit', 'Site Visit', '#ef4444'),
    ],
  },

  // ---------------- Travel & Catalog ----------------
  {
    key: 'destination',
    label: 'Destinations',
    group: 'travel',
    description: 'Destinations / regions you sell.',
    supportsColor: true,
    defaults: [
      s('kashmir', 'Kashmir', '#0ea5e9'),
      s('kerala', 'Kerala', '#22c55e'),
      s('goa', 'Goa', '#f59e0b'),
      s('rajasthan', 'Rajasthan', '#f97316'),
      s('dubai', 'Dubai', '#8b5cf6'),
      s('thailand', 'Thailand', '#ec4899'),
      s('bali', 'Bali', '#14b8a6'),
    ],
  },
  {
    key: 'city',
    label: 'Cities',
    group: 'travel',
    description: 'Cities used across hotels, transfers & routes.',
    supportsColor: true,
    defaults: [
      s('srinagar', 'Srinagar', '#0ea5e9'),
      s('gulmarg', 'Gulmarg', '#22c55e'),
      s('pahalgam', 'Pahalgam', '#f59e0b'),
      s('sonamarg', 'Sonamarg', '#8b5cf6'),
      s('jammu', 'Jammu', '#f97316'),
    ],
  },
  {
    key: 'room_type',
    label: 'Room Types',
    group: 'travel',
    description: 'Room types used for hotel bookings & costing.',
    defaults: [
      s('deluxe', 'DELUXE'),
      s('super_deluxe', 'SUPER DELUXE'),
      s('standard', 'STANDARD'),
      s('suite', 'SUITE'),
      s('premium', 'PREMIUM'),
    ],
  },
  {
    key: 'country',
    label: 'Countries',
    group: 'travel',
    description: 'Countries for destinations & visas.',
    defaults: [
      s('india', 'India'),
      s('uae', 'United Arab Emirates'),
      s('thailand', 'Thailand'),
      s('indonesia', 'Indonesia'),
      s('singapore', 'Singapore'),
      s('maldives', 'Maldives'),
    ],
  },
  {
    key: 'package_category',
    label: 'Package Categories',
    group: 'travel',
    description: 'Tiers / categories for tour packages.',
    supportsColor: true,
    defaults: [
      s('silver', 'Silver', '#94a3b8'),
      s('gold', 'Gold', '#f59e0b'),
      s('platinum', 'Platinum', '#6366f1'),
      s('luxury', 'Luxury', '#a855f7'),
    ],
  },
  {
    key: 'visa_type',
    label: 'Visa Types',
    group: 'travel',
    description: 'Visa categories offered.',
    defaults: [
      s('tourist', 'Tourist Visa'),
      s('business', 'Business Visa'),
      s('transit', 'Transit Visa'),
      s('evisa', 'e-Visa'),
      s('visa_on_arrival', 'Visa on Arrival'),
    ],
  },
  {
    key: 'document_type',
    label: 'Document Types',
    group: 'travel',
    description: 'Traveller document categories.',
    defaults: [
      s('passport', 'Passport'),
      s('id_card', 'ID Card'),
      s('photo', 'Photo'),
      s('visa_copy', 'Visa Copy'),
    ],
  },
  {
    key: 'cancellation_reason',
    label: 'Cancellation Reasons',
    group: 'travel',
    description: 'Reasons for booking cancellations.',
    supportsColor: true,
    defaults: [
      s('customer_request', 'Customer request', '#f97316'),
      s('payment_failure', 'Payment failure', '#ef4444'),
      s('supplier_issue', 'Supplier issue', '#dc2626'),
      s('force_majeure', 'Force majeure', '#6b7280'),
    ],
  },
  {
    key: 'inclusion',
    label: 'Inclusions Catalog',
    group: 'travel',
    description: 'Reusable inclusion lines for itinerary quotes.',
    defaults: [
      s(slugifyKey('Accommodation on twin sharing basis'), 'Accommodation on twin sharing basis'),
      s(slugifyKey('Daily breakfast and dinner'), 'Daily breakfast and dinner'),
      s(
        slugifyKey('All transfers and sightseeing by private vehicle'),
        'All transfers and sightseeing by private vehicle'
      ),
      s(slugifyKey('Toll taxes, parking, and driver allowance'), 'Toll taxes, parking, and driver allowance'),
      s(slugifyKey('All applicable hotel taxes'), 'All applicable hotel taxes'),
    ],
  },
  {
    key: 'exclusion',
    label: 'Exclusions Catalog',
    group: 'travel',
    description: 'Reusable exclusion lines for itinerary quotes.',
    defaults: [
      s(slugifyKey('Airfare / train tickets'), 'Airfare / train tickets'),
      s(slugifyKey('Personal expenses and tips'), 'Personal expenses and tips'),
      s(slugifyKey('Entry fees at monuments and gardens'), 'Entry fees at monuments and gardens'),
      s(slugifyKey('Gondola ride and adventure activities'), 'Gondola ride and adventure activities'),
      s(slugifyKey('Anything not mentioned in inclusions'), 'Anything not mentioned in inclusions'),
    ],
  },
  {
    key: 'supplement',
    label: 'Supplements Catalog',
    group: 'travel',
    description: 'Reusable supplement / extra-cost lines for itinerary quotes.',
    defaults: [
      s(
        slugifyKey('Gondola ride (Phase 1 & 2): As per actual'),
        'Gondola ride (Phase 1 & 2): As per actual'
      ),
      s(slugifyKey('Pony ride at Pahalgam: On direct payment'), 'Pony ride at Pahalgam: On direct payment'),
      s(slugifyKey('Shikara ride on Dal Lake: Optional'), 'Shikara ride on Dal Lake: Optional'),
    ],
  },
  {
    key: 'term',
    label: 'Terms & Conditions Catalog',
    group: 'travel',
    description: 'Reusable terms & conditions lines for itinerary quotes.',
    defaults: [
      s(
        slugifyKey('Package is subject to availability at the time of booking'),
        'Package is subject to availability at the time of booking'
      ),
      s(
        slugifyKey('30% advance payment required to process the booking'),
        '30% advance payment required to process the booking'
      ),
      s(
        slugifyKey('Rest payment need to be paid on 1st day of arrival'),
        'Rest payment need to be paid on 1st day of arrival'
      ),
      s(slugifyKey('No refund in case of early return or No show'), 'No refund in case of early return or No show'),
    ],
  },
  {
    key: 'cancellation_policy',
    label: 'Cancellation Policy Catalog',
    group: 'travel',
    description: 'Reusable cancellation-policy lines for itinerary quotes.',
    defaults: [
      s(
        slugifyKey('Cancellation before 30 days: 20% of total cost'),
        'Cancellation before 30 days: 20% of total cost'
      ),
      s(
        slugifyKey('Cancellation before 20 days: 50% of total cost'),
        'Cancellation before 20 days: 50% of total cost'
      ),
      s(slugifyKey('Cancellation within 15 days: No refund'), 'Cancellation within 15 days: No refund'),
    ],
  },

  // ---------------- Bookings & Operations ----------------
  {
    key: 'booking_status',
    label: 'Booking Statuses',
    group: 'operations',
    description: 'Status of a confirmed booking.',
    supportsColor: true,
    defaults: [
      s('pending', 'Pending', '#f59e0b'),
      s('confirmed', 'Confirmed', '#22c55e'),
      s('in_progress', 'In Progress', '#0ea5e9'),
      s('completed', 'Completed', '#16a34a'),
      s('cancelled', 'Cancelled', '#ef4444'),
    ],
  },
  {
    key: 'supplier_category',
    label: 'Supplier Categories',
    group: 'operations',
    description: 'Types of suppliers / vendors.',
    supportsColor: true,
    defaults: [
      s('hotel', 'Hotel', '#0ea5e9'),
      s('transport', 'Transport', '#f59e0b'),
      s('airline', 'Airline', '#6366f1'),
      s('dmc', 'DMC', '#8b5cf6'),
      s('activity', 'Activity Provider', '#22c55e'),
      s('visa', 'Visa Agent', '#ec4899'),
    ],
  },
  {
    key: 'airline',
    label: 'Airlines',
    group: 'operations',
    description: 'Airlines used in itineraries.',
    defaults: [
      s('air_india', 'Air India'),
      s('indigo', 'IndiGo'),
      s('vistara', 'Vistara'),
      s('emirates', 'Emirates'),
      s('qatar', 'Qatar Airways'),
    ],
  },
  {
    key: 'hotel_category',
    label: 'Hotel Categories',
    group: 'operations',
    description: 'Star / category ratings for hotels.',
    supportsColor: true,
    defaults: [
      s('3_star', '3 Star', '#94a3b8'),
      s('4_star', '4 Star', '#f59e0b'),
      s('5_star', '5 Star', '#6366f1'),
      s('boutique', 'Boutique', '#a855f7'),
      s('resort', 'Resort', '#14b8a6'),
    ],
  },

  // ---------------- Finance ----------------
  {
    key: 'payment_method',
    label: 'Payment Methods',
    group: 'finance',
    description: 'Accepted payment methods.',
    defaults: [
      s('cash', 'Cash'),
      s('bank_transfer', 'Bank Transfer'),
      s('upi', 'UPI'),
      s('card', 'Credit / Debit Card'),
      s('razorpay', 'Razorpay'),
      s('cheque', 'Cheque'),
    ],
  },
  {
    key: 'payment_status',
    label: 'Payment Statuses',
    group: 'finance',
    description: 'Status of a payment.',
    supportsColor: true,
    defaults: [
      s('pending', 'Pending', '#f59e0b'),
      s('partial', 'Partial', '#0ea5e9'),
      s('paid', 'Paid', '#22c55e'),
      s('refunded', 'Refunded', '#8b5cf6'),
      s('failed', 'Failed', '#ef4444'),
    ],
  },
  {
    key: 'invoice_status',
    label: 'Invoice Statuses',
    group: 'finance',
    description: 'Status of an invoice.',
    supportsColor: true,
    defaults: [
      s('draft', 'Draft', '#94a3b8'),
      s('sent', 'Sent', '#0ea5e9'),
      s('paid', 'Paid', '#22c55e'),
      s('overdue', 'Overdue', '#ef4444'),
      s('cancelled', 'Cancelled', '#6b7280'),
    ],
  },
  {
    key: 'currency',
    label: 'Currencies',
    group: 'finance',
    description: 'Currencies used for quotes & invoices.',
    defaults: [
      s('INR', 'INR (₹)', undefined, { metadata: { symbol: '₹' } }),
      s('USD', 'USD ($)', undefined, { metadata: { symbol: '$' } }),
      s('EUR', 'EUR (€)', undefined, { metadata: { symbol: '€' } }),
      s('GBP', 'GBP (£)', undefined, { metadata: { symbol: '£' } }),
      s('AED', 'AED (د.إ)', undefined, { metadata: { symbol: 'AED' } }),
    ],
  },
  {
    key: 'tax',
    label: 'Taxes',
    group: 'finance',
    description: 'Tax rates applied to invoices.',
    defaults: [
      s('gst_5', 'GST 5%', undefined, { metadata: { rate: 5 } }),
      s('gst_12', 'GST 12%', undefined, { metadata: { rate: 12 } }),
      s('gst_18', 'GST 18%', undefined, { metadata: { rate: 18 } }),
      s('tcs_5', 'TCS 5%', undefined, { metadata: { rate: 5 } }),
    ],
  },
  {
    key: 'discount',
    label: 'Discounts',
    group: 'finance',
    description: 'Reusable discount presets.',
    defaults: [
      s('early_bird', 'Early Bird', undefined, { metadata: { percent: 10 } }),
      s('group', 'Group Discount', undefined, { metadata: { percent: 15 } }),
      s('repeat_customer', 'Repeat Customer', undefined, { metadata: { percent: 5 } }),
    ],
  },

  // ---------------- Organization ----------------
  {
    key: 'department',
    label: 'Departments',
    group: 'organization',
    description: 'Company departments.',
    defaults: [
      s('sales', 'Sales'),
      s('operations', 'Operations'),
      s('accounts', 'Accounts'),
      s('support', 'Support'),
    ],
  },
  {
    key: 'tag',
    label: 'Tags',
    group: 'organization',
    description: 'Free-form tags used across records.',
    supportsColor: true,
    defaults: [
      s('vip', 'VIP', '#a855f7'),
      s('honeymoon', 'Honeymoon', '#ec4899'),
      s('family', 'Family', '#22c55e'),
      s('corporate', 'Corporate', '#6366f1'),
      s('repeat', 'Repeat', '#f59e0b'),
    ],
  },
  {
    key: 'label',
    label: 'Labels',
    group: 'organization',
    description: 'Colored labels for quick tagging.',
    supportsColor: true,
    defaults: [
      s('hot', 'Hot', '#ef4444'),
      s('warm', 'Warm', '#f59e0b'),
      s('cold', 'Cold', '#0ea5e9'),
    ],
  },
]

/**
 * Specific system-default option keys that are fully locked — they cannot be
 * renamed, edited, archived, or deleted by anyone (only reordered). Core app
 * logic depends on these exact keys ('new' = default entry stage, 'booked' =
 * drives the booking/handoff flow), so they must stay fixed. Every other
 * default stays editable.
 */
export const LOCKED_SYSTEM_KEYS = {
  lead_status: ['new', 'booked'],
}

/** True if this option is a locked system default (immutable). */
export function isLockedOption(option) {
  if (!option?.isSystem) return false
  const keys = LOCKED_SYSTEM_KEYS[option.category]
  return !!keys && keys.includes(option.key)
}

export const CATEGORY_MAP = MASTER_CATEGORIES.reduce((acc, c) => {
  acc[c.key] = c
  return acc
}, {})

export function getCategory(key) {
  return CATEGORY_MAP[key] || null
}

export function categoriesByGroup(groupId) {
  return MASTER_CATEGORIES.filter((c) => c.group === groupId)
}

/** slugify a label into a stable machine key */
export function slugifyKey(label) {
  return String(label || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}
