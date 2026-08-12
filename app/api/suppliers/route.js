import connectDB from '@/lib/mongodb'
import Supplier from '@/models/Supplier'
import { authenticate, requireRoles } from '@/lib/middleware'

/** Supplier billing is an Owner/Accounts function — Operations calls hotels
 * directly from the booking confirmation flow but never touches this API. */
const SUPPLIER_ROLES = ['admin', 'accounts']

export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }
    const forbidden = requireRoles(authResult.user.role, SUPPLIER_ROLES)
    if (forbidden) {
      return Response.json({ error: forbidden.error }, { status: forbidden.status })
    }

    await connectDB()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const q = searchParams.get('q')

    const query = { teamId: authResult.user.teamId, isActive: { $ne: false } }
    if (type) query.type = type
    if (q) {
      query.$or = [
        { name: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
        { 'address.city': new RegExp(q, 'i') },
      ]
    }

    const suppliers = await Supplier.find(query).sort({ name: 1 }).limit(100).lean()
    return Response.json({ suppliers })
  } catch (error) {
    console.error('Get suppliers error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }
    const forbidden = requireRoles(authResult.user.role, SUPPLIER_ROLES)
    if (forbidden) {
      return Response.json({ error: forbidden.error }, { status: forbidden.status })
    }

    await connectDB()
    const body = await request.json()
    if (!body.name || !body.type || !body.email) {
      return Response.json({ error: 'name, type, and email are required' }, { status: 400 })
    }

    const supplier = await Supplier.create({
      ...body,
      teamId: authResult.user.teamId,
    })

    return Response.json({ supplier }, { status: 201 })
  } catch (error) {
    console.error('Create supplier error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
