import connectDB from '@/lib/mongodb'
import Team from '@/models/Team'
import User from '@/models/User'
import Lead from '@/models/Lead'
import Booking from '@/models/Booking'
import Payment from '@/models/Payment'
import Plan from '@/models/Plan'
import { requireSuperadmin, denied } from '@/lib/superadmin'
import { seedDefaultPlans } from '@/lib/plans'

/** Platform-wide overview for the super admin landing page. */
export async function GET(request) {
  try {
    const guard = await requireSuperadmin(request)
    if (guard.error) return denied(guard)

    await connectDB()
    await seedDefaultPlans()

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const [
      agencyCount,
      activeAgencies,
      suspendedAgencies,
      newAgencies30d,
      userCount,
      leadCount,
      leads30d,
      bookingCount,
      revenueAgg,
      revenueMonthAgg,
      planRows,
      plans,
      recentAgencies,
    ] = await Promise.all([
      Team.countDocuments({}),
      Team.countDocuments({ isActive: { $ne: false } }),
      Team.countDocuments({ isActive: false }),
      Team.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      User.countDocuments({}),
      Lead.countDocuments({}),
      Lead.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Booking.countDocuments({}),
      Payment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, sum: { $sum: '$amount' } } },
      ]),
      Payment.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, sum: { $sum: '$amount' } } },
      ]),
      Team.aggregate([{ $group: { _id: '$plan', n: { $sum: 1 } } }]),
      Plan.find({}).sort({ sortOrder: 1 }).lean(),
      Team.find({})
        .select('name plan subscriptionStatus isActive createdAt')
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
    ])

    const planCounts = Object.fromEntries(planRows.map((r) => [r._id || 'basic', r.n]))

    // Recurring revenue implied by what agencies are currently subscribed to,
    // counting only agencies that are actually live and paying.
    const billableStatuses = ['active', 'past_due']
    const billableRows = await Team.aggregate([
      { $match: { isActive: { $ne: false }, subscriptionStatus: { $in: billableStatuses } } },
      { $group: { _id: '$plan', n: { $sum: 1 } } },
    ])
    const priceByKey = Object.fromEntries(plans.map((p) => [p.key, p.priceMonthly || 0]))
    const mrr = billableRows.reduce((sum, r) => sum + (priceByKey[r._id] || 0) * r.n, 0)

    return Response.json({
      totals: {
        agencies: agencyCount,
        activeAgencies,
        suspendedAgencies,
        newAgencies30d,
        users: userCount,
        leads: leadCount,
        leads30d,
        bookings: bookingCount,
        gmv: revenueAgg[0]?.sum || 0,
        gmvThisMonth: revenueMonthAgg[0]?.sum || 0,
        mrr,
      },
      planCounts,
      plans,
      recentAgencies,
    })
  } catch (error) {
    console.error('Superadmin stats error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
