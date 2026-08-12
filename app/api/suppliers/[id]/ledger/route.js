import connectDB from '@/lib/mongodb'
import Supplier from '@/models/Supplier'
import SupplierLedgerEntry from '@/models/SupplierLedgerEntry'
import { authenticate, requireRoles } from '@/lib/middleware'

export async function GET(request, { params }) {
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
    const { id } = await params

    const supplier = await Supplier.findOne({ _id: id, teamId: authResult.user.teamId }).lean()
    if (!supplier) {
      return Response.json({ error: 'Supplier not found' }, { status: 404 })
    }

    const entries = await SupplierLedgerEntry.find({ supplierId: id, teamId: authResult.user.teamId })
      .populate('bookingId', 'bookingNumber')
      .populate('leadId', 'firstName lastName')
      .populate('createdBy', 'name')
      .sort({ date: -1, createdAt: -1 })
      .lean()

    return Response.json({ entries, balanceDue: supplier.balanceDue || 0 })
  } catch (error) {
    console.error('Get supplier ledger error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
