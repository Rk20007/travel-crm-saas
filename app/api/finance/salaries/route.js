import connectDB from '@/lib/mongodb'
import SalaryPayment from '@/models/SalaryPayment'
import User from '@/models/User'
import { authenticate, requireRoles } from '@/lib/middleware'

/** Salary payouts to team members — for the Company Finance dashboard's
 * expense tracking. */
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

    const salaries = await SalaryPayment.find(query).sort({ date: -1 }).lean()
    return Response.json({ salaries })
  } catch (error) {
    console.error('List salary payments error:', error)
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
    if (!body.month) {
      return Response.json({ error: 'Select which month this salary is for' }, { status: 400 })
    }

    let employeeName = body.employeeName
    let employeeRole = body.employeeRole
    if (body.userId) {
      const user = await User.findOne({ _id: body.userId, teamId: authResult.user.teamId }).select('name role').lean()
      if (user) {
        employeeName = user.name
        employeeRole = user.role
      }
    }
    if (!employeeName) {
      return Response.json({ error: 'Select an employee' }, { status: 400 })
    }

    const salary = await SalaryPayment.create({
      teamId: authResult.user.teamId,
      userId: body.userId || undefined,
      employeeName,
      employeeRole,
      amount,
      month: body.month,
      remark: body.remark || '',
      proofUrl: body.proofUrl || undefined,
      date: body.date ? new Date(body.date) : new Date(),
      createdBy: authResult.user.userId,
    })

    return Response.json({ salary }, { status: 201 })
  } catch (error) {
    console.error('Create salary payment error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
