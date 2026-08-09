import connectDB from '@/lib/mongodb'
import Lead from '@/models/Lead'
import Payment from '@/models/Payment'
import { authenticate } from '@/lib/middleware'
import mongoose from 'mongoose'

function startOfDay(d) {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

function startOfMonth(d) {
  const x = new Date(d)
  x.setUTCDate(1)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    await connectDB()
    const tid = new mongoose.Types.ObjectId(String(authResult.user.teamId))

    const q = { teamId: tid }
    if (authResult.user.brandId) {
      q.brandId = new mongoose.Types.ObjectId(String(authResult.user.brandId))
    }

    const now = new Date()
    const sod = startOfDay(now)
    const som = startOfMonth(now)

    const [leadsToday, leadsMonth, bySource, statusMix, booked, total, perAgent, revenuePay] =
      await Promise.all([
        Lead.countDocuments({ ...q, createdAt: { $gte: sod } }),
        Lead.countDocuments({ ...q, createdAt: { $gte: som } }),
        Lead.aggregate([{ $match: q }, { $group: { _id: '$source', count: { $sum: 1 } } }]),
        Lead.aggregate([{ $match: q }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
        Lead.countDocuments({ ...q, status: 'booked' }),
        Lead.countDocuments(q),
        Lead.aggregate([
          { $match: { ...q, assignedTo: { $exists: true, $ne: null } } },
          { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
          { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
          {
            $project: {
              userId: '$_id',
              name: { $arrayElemAt: ['$u.name', 0] },
              count: 1,
            },
          },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        Payment.aggregate([
          { $match: { teamId: tid, status: 'completed' } },
          { $group: { _id: null, sum: { $sum: '$amount' } } },
        ]).catch(() => []),
      ])

    const conversionRate = total ? Math.round((booked / total) * 1000) / 10 : 0
    const revenueCollected = revenuePay[0]?.sum || 0

    return Response.json({
      leadsToday,
      leadsMonth,
      conversionRate,
      bySource,
      statusMix,
      agentPerformance: perAgent,
      revenueCollectedApprox: revenueCollected,
    })
  } catch (error) {
    console.error('Analytics summary error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
