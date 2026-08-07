import connectDB from '@/lib/mongodb'
import Supplier from '@/models/Supplier'
import SupplierLedgerEntry from '@/models/SupplierLedgerEntry'
import { authenticate, requireRoles } from '@/lib/middleware'

/** Manually adjusts a charge's total up or down after the fact — e.g. the
 * vehicle got swapped mid-trip, or a hotel stay ran an extra day. Always
 * requires a remark so the ledger stays auditable instead of a total just
 * silently changing. */
export async function PATCH(request, { params }) {
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
    const { id, chargeId } = await params
    const body = await request.json()
    const amount = Number(body.amount)
    const direction = body.direction
    const remark = String(body.remark || '').trim()

    if (!(amount > 0)) {
      return Response.json({ error: 'Enter a valid amount' }, { status: 400 })
    }
    if (!['add', 'subtract'].includes(direction)) {
      return Response.json({ error: 'direction must be add or subtract' }, { status: 400 })
    }
    if (!remark) {
      return Response.json({ error: 'Add a remark explaining this adjustment' }, { status: 400 })
    }

    const supplier = await Supplier.findOne({ _id: id, teamId: authResult.user.teamId })
    if (!supplier) {
      return Response.json({ error: 'Supplier not found' }, { status: 404 })
    }

    const charge = await SupplierLedgerEntry.findOne({ _id: chargeId, supplierId: supplier._id, type: 'charge' })
    if (!charge) {
      return Response.json({ error: 'Charge not found' }, { status: 404 })
    }

    const signedDelta = direction === 'add' ? amount : -amount
    const newAmount = Math.max(0, (charge.amount || 0) + signedDelta)
    const appliedDelta = newAmount - (charge.amount || 0)

    charge.amount = newAmount
    charge.adjustments.push({
      amount,
      direction,
      remark,
      date: new Date(),
      createdBy: authResult.user.userId,
    })
    await charge.save()

    if (appliedDelta) {
      supplier.balanceDue = (supplier.balanceDue || 0) + appliedDelta
      await supplier.save()
    }

    return Response.json({ charge, balanceDue: supplier.balanceDue })
  } catch (error) {
    console.error('Adjust supplier charge error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
