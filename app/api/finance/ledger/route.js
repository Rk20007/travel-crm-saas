import connectDB from '@/lib/mongodb'
import Invoice from '@/models/Invoice'
import Booking from '@/models/Booking'
import CompanyExpense from '@/models/CompanyExpense'
import SalaryPayment from '@/models/SalaryPayment'
import { authenticate, requireRoles } from '@/lib/middleware'

const INVOICE_TYPE_LABELS = {
  proforma: 'Partial Invoice',
  advance: 'Advance Invoice',
  tax_invoice: 'Final Invoice',
  credit_note: 'Credit Note',
}

function csvCell(value) {
  const s = value == null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Combined income (invoice collections) + expense (company overheads and
 * salaries) log for a date range — the raw trail behind the Company Finance
 * summary cards, exportable to Excel/CSV for offline record-keeping. */
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
    const teamId = authResult.user.teamId
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const exportCsv = searchParams.get('export') === 'csv'

    const from = fromParam ? new Date(fromParam) : new Date(0)
    const to = toParam ? new Date(new Date(toParam).getTime() + 86400000 - 1) : new Date()

    const [invoices, expenses, salaries, refundedBookings] = await Promise.all([
      Invoice.find({ teamId, invoiceDate: { $gte: from, $lte: to }, amountPaid: { $gt: 0 } })
        .select('invoiceNumber invoiceType clientName amountPaid invoiceDate bookingId')
        .lean(),
      CompanyExpense.find({ teamId, date: { $gte: from, $lte: to } }).select('category amount remark date').lean(),
      SalaryPayment.find({ teamId, date: { $gte: from, $lte: to } })
        .select('employeeName amount month remark date')
        .lean(),
      Booking.find({
        teamId,
        status: 'cancelled',
        refundStatus: 'paid',
        refundPaidAt: { $gte: from, $lte: to },
      })
        .populate('leadId', 'firstName lastName')
        .select('refundAmount refundPaidAt leadId bookingNumber')
        .lean(),
    ])

    // A cancelled booking's earlier invoice collections aren't real revenue
    // for this period anymore — exclude them so a client who got refunded
    // doesn't still show up as income in the ledger.
    const cancelledBookingIds = new Set(
      (
        await Booking.find({ teamId, status: 'cancelled' }).select('_id').lean()
      ).map((b) => String(b._id))
    )

    const entries = [
      ...invoices
        .filter((i) => !cancelledBookingIds.has(String(i.bookingId)))
        .map((i) => ({
          date: i.invoiceDate,
          type: 'income',
          category: INVOICE_TYPE_LABELS[i.invoiceType] || 'Invoice',
          description: i.invoiceNumber,
          party: i.clientName,
          amount: i.amountPaid,
        })),
      ...expenses.map((e) => ({
        date: e.date,
        type: 'expense',
        category: e.category ? e.category[0].toUpperCase() + e.category.slice(1) : 'Other',
        description: e.remark || '',
        party: '',
        amount: e.amount,
      })),
      ...salaries.map((s) => ({
        date: s.date,
        type: 'expense',
        category: 'Salary',
        description: [`Salary for ${s.month}`, s.remark].filter(Boolean).join(' — '),
        party: s.employeeName,
        amount: s.amount,
      })),
      ...refundedBookings.map((b) => ({
        date: b.refundPaidAt,
        type: 'expense',
        category: 'Refund',
        description: `Cancelled booking ${b.bookingNumber}`,
        party: b.leadId ? [b.leadId.firstName, b.leadId.lastName].filter(Boolean).join(' ') : '',
        amount: b.refundAmount || 0,
      })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date))

    let running = 0
    for (const e of entries) {
      running += e.type === 'income' ? e.amount : -e.amount
      e.balance = running
    }

    const totalIncome = entries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0)
    const totalExpense = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0)

    if (exportCsv) {
      const rows = [
        ['Date', 'Type', 'Category', 'Description', 'Party', 'Income (₹)', 'Expense (₹)', 'Balance (₹)'],
        ...entries.map((e) => [
          formatDate(e.date),
          e.type === 'income' ? 'Income' : 'Expense',
          e.category,
          e.description,
          e.party,
          e.type === 'income' ? e.amount : '',
          e.type === 'expense' ? e.amount : '',
          e.balance,
        ]),
        [],
        ['', '', '', '', 'Total', totalIncome, totalExpense, totalIncome - totalExpense],
      ]
      const csv = toCsv(rows)
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="finance-ledger-${fromParam || 'all'}-to-${toParam || 'now'}.csv"`,
        },
      })
    }

    return Response.json({ entries, totals: { income: totalIncome, expense: totalExpense, net: totalIncome - totalExpense } })
  } catch (error) {
    console.error('Finance ledger error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
