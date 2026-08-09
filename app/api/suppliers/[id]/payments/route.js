import connectDB from '@/lib/mongodb'
import Supplier from '@/models/Supplier'
import SupplierLedgerEntry from '@/models/SupplierLedgerEntry'
import { authenticate, requireRoles } from '@/lib/middleware'

/** Accounts logs a payment made to a supplier (e.g. paying a hotel toward
 * its outstanding room charges) — this is what moves Supplier.balanceDue
 * from, say, 50K down to 40K after a 10K payment. */
export async function POST(request, { params }) {
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
    const body = await request.json()
    const amount = Number(body.amount)

    if (!(amount > 0)) {
      return Response.json({ error: 'A positive amount is required' }, { status: 400 })
    }

    const supplier = await Supplier.findOne({ _id: id, teamId: authResult.user.teamId })
    if (!supplier) {
      return Response.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Paying one client's charge directly (from that row's "Add payment")
    // instead of a lump sum against the whole supplier — requires proof,
    // and applies straight to that charge rather than FIFO across all of them.
    if (body.chargeEntryId) {
      if (!body.screenshotUrl) {
        return Response.json(
          { error: 'Upload a screenshot of the payment made before saving' },
          { status: 400 }
        )
      }
      const charge = await SupplierLedgerEntry.findOne({
        _id: body.chargeEntryId,
        supplierId: supplier._id,
        type: 'charge',
      })
      if (!charge) {
        return Response.json({ error: 'Charge not found' }, { status: 404 })
      }

      const entry = await SupplierLedgerEntry.create({
        supplierId: supplier._id,
        teamId: authResult.user.teamId,
        type: 'payment',
        amount,
        bookingId: charge.bookingId,
        leadId: charge.leadId,
        hotelKey: charge.hotelKey,
        vehicleKey: charge.vehicleKey,
        note: body.note || '',
        screenshotUrl: body.screenshotUrl,
        date: body.date ? new Date(body.date) : new Date(),
        createdBy: authResult.user.userId,
      })

      charge.paidAmount = (charge.paidAmount || 0) + amount
      charge.screenshotUrl = body.screenshotUrl
      await charge.save()

      supplier.balanceDue = (supplier.balanceDue || 0) - amount
      await supplier.save()

      return Response.json({ entry, balanceDue: supplier.balanceDue, charge }, { status: 201 })
    }

    const entry = await SupplierLedgerEntry.create({
      supplierId: supplier._id,
      teamId: authResult.user.teamId,
      type: 'payment',
      amount,
      note: body.note || '',
      screenshotUrl: body.screenshotUrl || undefined,
      date: body.date ? new Date(body.date) : new Date(),
      createdBy: authResult.user.userId,
    })

    supplier.balanceDue = (supplier.balanceDue || 0) - amount
    await supplier.save()

    // A payment here is a lump sum against the supplier, not tied to one
    // booking — auto-allocate it oldest-charge-first so each booking's
    // ledger row can still show whether its specific charge is cleared.
    let remaining = amount
    const openCharges = await SupplierLedgerEntry.find({
      supplierId: supplier._id,
      type: 'charge',
      $expr: { $lt: ['$paidAmount', '$amount'] },
    }).sort({ date: 1, createdAt: 1 })
    for (const charge of openCharges) {
      if (remaining <= 0) break
      const due = charge.amount - (charge.paidAmount || 0)
      const apply = Math.min(due, remaining)
      charge.paidAmount = (charge.paidAmount || 0) + apply
      await charge.save()
      remaining -= apply
    }

    return Response.json({ entry, balanceDue: supplier.balanceDue }, { status: 201 })
  } catch (error) {
    console.error('Record supplier payment error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
