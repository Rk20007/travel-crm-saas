import connectDB from '@/lib/mongodb'
import CompanyExpense from '@/models/CompanyExpense'
import { authenticate, requireRoles } from '@/lib/middleware'

/** Company overhead expenses (rent, utilities, marketing, misc) — separate
 * from per-booking vendor charges, for the Company Finance dashboard. */
export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }
    const forbidden = requireRoles(authResult.user.role, ['admin', 'accounts'])
    if (forbidden) {
      return Response.json({ error: forbidden.error }, { status: forbidden.status })
    }

    await connectDB()
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    const query = { teamId: authResult.user.teamId }
    if (year) {
      const y = Number(year)
      const m = month ? Number(month) : null
      const start = m ? new Date(y, m - 1, 1) : new Date(y, 0, 1)
      const end = m ? new Date(y, m, 1) : new Date(y + 1, 0, 1)
      query.date = { $gte: start, $lt: end }
    }

    const expenses = await CompanyExpense.find(query)
      .populate('createdBy', 'name')
      .sort({ date: -1 })
      .lean()

    return Response.json({ expenses })
  } catch (error) {
    console.error('List company expenses error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }
    const forbidden = requireRoles(authResult.user.role, ['admin', 'accounts'])
    if (forbidden) {
      return Response.json({ error: forbidden.error }, { status: forbidden.status })
    }

    await connectDB()
    const body = await request.json()
    const amount = Number(body.amount)
    if (!(amount > 0)) {
      return Response.json({ error: 'Enter a valid amount' }, { status: 400 })
    }

    const expense = await CompanyExpense.create({
      teamId: authResult.user.teamId,
      category: body.category || 'other',
      amount,
      remark: body.remark || '',
      proofUrl: body.proofUrl || undefined,
      date: body.date ? new Date(body.date) : new Date(),
      createdBy: authResult.user.userId,
    })

    return Response.json({ expense }, { status: 201 })
  } catch (error) {
    console.error('Create company expense error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
