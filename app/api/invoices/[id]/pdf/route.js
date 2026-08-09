import connectDB from '@/lib/mongodb'
import mongoose from 'mongoose'
import Invoice from '@/models/Invoice'
import Booking from '@/models/Booking'
import Lead from '@/models/Lead'
import Itinerary from '@/models/Itinerary'
import ItineraryDay from '@/models/ItineraryDay'
import Brand from '@/models/Brand'
import { authenticate } from '@/lib/middleware'
import { buildInvoicePdf } from '@/lib/pdf/invoicePdf'

export const runtime = 'nodejs'

export async function GET(request, { params }) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = await params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ error: 'Invalid invoice ID' }, { status: 400 })
    }

    await connectDB()
    const invoice = await Invoice.findOne({ _id: id, teamId: authResult.user.teamId }).lean()
    if (!invoice) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const booking = invoice.bookingId
      ? await Booking.findOne({ _id: invoice.bookingId, teamId: authResult.user.teamId }).lean()
      : null

    const [lead, itinerary] = await Promise.all([
      invoice.leadId
        ? Lead.findById(invoice.leadId).lean()
        : booking?.leadId
          ? Lead.findById(booking.leadId).lean()
          : null,
      booking?.itineraryId ? Itinerary.findById(booking.itineraryId).lean() : null,
    ])

    let brand = null
    const brandId = itinerary?.brandId || authResult.user.brandId
    if (brandId) {
      brand = await Brand.findOne({ _id: brandId, teamId: authResult.user.teamId, isActive: true }).lean()
    }
    if (!brand) {
      brand = await Brand.findOne({ teamId: authResult.user.teamId, isActive: true })
        .sort({ isDefault: -1, name: 1 })
        .lean()
    }

    // Arrival/Departure on the invoice must match the itinerary's actual
    // day-wise plan (Day 1 / last day), not the booking's top-level
    // startDate/endDate — those go stale if the plan is edited afterward.
    let bookingForPdf = booking
    if (booking?.itineraryId) {
      const days = await ItineraryDay.find({ itineraryId: booking.itineraryId, date: { $ne: null } })
        .select('date')
        .sort({ date: 1 })
        .lean()
      if (days.length) {
        bookingForPdf = { ...booking, startDate: days[0].date, endDate: days[days.length - 1].date }
      }
    }

    // A Partial/Advance invoice's own totalAmount is just that payment, not
    // the trip's real cost — so "Total Package Cost" and "Balance Due" on
    // the printed invoice come from the booking's actual package total and
    // everything received across every invoice raised for it, not just this one.
    const packageTotal = booking?.totalAmount || invoice.totalAmount
    let totalReceivedOverall = invoice.amountPaid || 0
    if (invoice.bookingId) {
      const siblingInvoices = await Invoice.find({ bookingId: invoice.bookingId, teamId: authResult.user.teamId })
        .select('amountPaid')
        .lean()
      totalReceivedOverall = siblingInvoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0)
    }

    const buffer = await buildInvoicePdf({
      invoice,
      booking: bookingForPdf,
      lead,
      itinerary,
      brand: brand || { name: 'Travel Agency' },
      packageTotal,
      totalReceivedOverall,
    })

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Invoice PDF export error:', error)
    return Response.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
