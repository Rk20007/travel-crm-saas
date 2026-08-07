import { createRequire } from 'module'
import { getThemeColors, fetchImageBuffer } from '@/lib/pdf/itineraryPdf'

const require = createRequire(import.meta.url)

function createPdfDocument(options) {
  const PDFDocument = require('pdfkit')
  return new PDFDocument(options)
}

const PAGE = { margin: 0, width: 421.68, height: 595.28 } // half-letter-ish, matches the compact card look

// Standard PDF fonts (WinAnsiEncoding) can't render the ₹ glyph — it falls
// back to a bogus superscript digit. Same "/-" convention used on the
// itinerary PDF, so amounts always render cleanly.
function formatInr(n) {
  return `Rs. ${Number(n || 0).toLocaleString('en-IN')}/-`
}

// Pill/label text sometimes has embedded newlines (e.g. a multi-line saved
// address) — PDFKit still honors literal \n even with lineBreak:false, so
// without this a "single-line" pill silently prints multiple lines and
// spills out of its box.
function oneLine(s) {
  return String(s || '').replace(/\s+/g, ' ').trim()
}

// pdfkit's ellipsis option only truncates across wrapped lines — with
// lineBreak:false (needed to force a single line) it doesn't truncate at
// all, so long pill text just overflows the box. Measuring and cutting the
// string manually guarantees it always fits on one line.
function truncateToWidth(doc, text, maxWidth) {
  if (doc.widthOfString(text) <= maxWidth) return text
  let truncated = text
  while (truncated.length > 0 && doc.widthOfString(truncated + '…') > maxWidth) {
    truncated = truncated.slice(0, -1)
  }
  return truncated + '…'
}

function formatDate(d) {
  if (!d) return '-'
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return '-'
  }
}

function leadName(lead) {
  if (!lead) return ''
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ')
}

/**
 * Compact branded invoice — logo + contact strip, Bill To / Trip Details,
 * a Service table, then a Costing table ending in a highlighted Balance Due.
 */
export async function buildInvoicePdf({ invoice, booking, lead, itinerary, brand, packageTotal, totalReceivedOverall }) {
  const colors = getThemeColors('classic')
  const m = 20
  const w = PAGE.width - m * 2

  const logoBuffer = await fetchImageBuffer(brand.logo)

  // Page height is computed up front (not fixed) — the header/costing block
  // is fully deterministic in height (no runtime text wrapping affects it),
  // so we size the page to exactly fit its content plus the footer, instead
  // of a fixed height that content could grow past and get cut off by the
  // fixed-position footer band.
  const rowH = 27
  const bannerH = 200
  const boxH = 92
  const boxY = bannerH - 42
  const items = invoice.items?.length ? invoice.items : []
  const footerH = 74
  const contentStartY = boxY + boxH + 16
  const serviceBlockH = rowH + 3 * rowH + 14
  const costingBarH = rowH + 4
  const itemsBlockH = items.length * rowH + 4
  const totalsBlockH = (rowH - 3) + rowH + rowH + (rowH + 2) + 20
  const pageHeight = contentStartY + serviceBlockH + costingBarH + itemsBlockH + totalsBlockH + footerH

  const doc = createPdfDocument({ size: [PAGE.width, pageHeight], margin: 0 })
  const chunks = []
  doc.on('data', (c) => chunks.push(c))
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  // Full-bleed red banner — logo, contact pills, and the INVOICE title all
  // sit on it, with the Bill To / Trip Details card overlapping its bottom
  // edge (ticket-stub style) so it reads as one connected header block.
  doc.rect(0, 0, PAGE.width, bannerH).fill(colors.red)

  const logoW = 130
  const logoH = 90
  const logoY = 18
  doc.roundedRect(m, logoY, logoW, logoH, 6).fill('#ffffff')
  if (logoBuffer) {
    const pad = 8
    doc.save()
    doc.roundedRect(m, logoY, logoW, logoH, 6).clip()
    doc.image(logoBuffer, m + pad, logoY + pad, {
      fit: [logoW - pad * 2, logoH - pad * 2],
      align: 'center',
      valign: 'center',
    })
    doc.restore()
  } else {
    doc
      .fillColor(colors.red)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text((brand.name || 'Travel Agency').toUpperCase(), m + 8, logoY + logoH / 2 - 8, {
        width: logoW - 16,
        align: 'center',
      })
  }

  // Contact pills — outlined (not filled), 2x2, to the right of the logo.
  const contactColX = m + logoW + 12
  const contactColW = w - logoW - 12
  const pillH = 32
  const pillGap = 8
  const pills = [
    brand.phone ? `+ ${oneLine(brand.phone)}` : null,
    brand.website ? oneLine(brand.website) : null,
    brand.email ? oneLine(brand.email) : null,
    oneLine(brand.address || itinerary?.destination || lead?.destination) || null,
  ].filter(Boolean)
  pills.forEach((p, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const pw = (contactColW - pillGap) / 2
    const px = contactColX + col * (pw + pillGap)
    const py = logoY + row * (pillH + pillGap)
    doc.roundedRect(px, py, pw, pillH, pillH / 2).lineWidth(1).strokeColor('#ffffff').stroke()
    doc.fillColor('#ffffff').font('Helvetica').fontSize(9)
    const pillText = truncateToWidth(doc, p, pw - 24)
    doc.text(pillText, px + 12, py + pillH / 2 - 5, { width: pw - 24, lineBreak: false })
  })

  // Invoice title, italic-bold, with the invoice number inline beside it.
  // (Font size dropped ~30%, from 26 to 18, per feedback.)
  const titleFontSize = 18
  const titleY = logoY + logoH + 26
  doc.fillColor('#ffffff').font('Helvetica-BoldOblique').fontSize(titleFontSize).text('INVOICE', m, titleY)
  const titleWidth = doc.widthOfString('INVOICE')
  doc
    .fillColor('#ffffff')
    .opacity(0.85)
    .font('Helvetica')
    .fontSize(10)
    .text(`No.: ${invoice.invoiceNumber}`, m + titleWidth + 10, titleY + 5)
    .opacity(1)

  // Bill To / Trip Details card — straddles the banner's bottom edge.
  doc.roundedRect(m, boxY, w, boxH, 6).fillAndStroke('#ffffff', colors.grayLight)
  const half = w / 2
  doc.moveTo(m + half, boxY + 12).lineTo(m + half, boxY + boxH - 12).strokeColor(colors.grayLight).lineWidth(1).stroke()

  doc.fillColor(colors.red).font('Helvetica-Bold').fontSize(9).text('BILL TO', m + 14, boxY + 12)
  doc
    .fillColor(colors.black)
    .font('Helvetica-Bold')
    .fontSize(12.5)
    .text((invoice.clientName || leadName(lead) || '-').toUpperCase(), m + 14, boxY + 25, { width: half - 24 })
  doc.fillColor(colors.gray).font('Helvetica').fontSize(9.5).text(invoice.clientPhone || lead?.phone || '-', m + 14, boxY + 41)
  doc
    .fillColor(colors.gray)
    .fontSize(9.5)
    .text(`Destination: ${itinerary?.destination || lead?.destination || '-'}`, m + 14, boxY + 55, { width: half - 24 })

  doc.fillColor(colors.red).font('Helvetica-Bold').fontSize(9).text('TRIP DETAILS', m + half + 14, boxY + 12)
  doc
    .fillColor(colors.black)
    .font('Helvetica')
    .fontSize(9.5)
    .text(`Arrival: ${formatDate(booking?.startDate)}`, m + half + 14, boxY + 25)
    .text(`Departure: ${formatDate(booking?.endDate)}`, m + half + 14, boxY + 38)
    .text(`Guests: ${booking?.numberOfTravelers ?? '-'}`, m + half + 14, boxY + 51)

  let y = contentStartY

  // Service table
  doc.fillColor(colors.red).font('Helvetica-Bold').fontSize(11.5).text('SERVICE', m, y).text('DETAILS', m + w - 110, y, { width: 100, align: 'right' })
  y += rowH
  doc.moveTo(m, y).lineTo(m + w, y).strokeColor(colors.grayLight).stroke()
  const hasVehicle = itinerary?.vehicles?.length > 0 || !!itinerary?.vehicle
  const hasHotels = itinerary?.nightStays?.length > 0
  const hasActivities = itinerary?.activities?.length > 0
  const services = [
    ['Ground Transportation', hasVehicle ? (itinerary.vehicle || itinerary.vehicles?.[0]?.name || 'Yes') : 'No'],
    ['Hotels', hasHotels ? 'Yes' : 'No'],
    ['Activities', hasActivities ? 'Yes' : 'No'],
  ]
  services.forEach(([label, val], i) => {
    const ry = y + i * rowH
    if (i % 2 === 1) doc.rect(m, ry, w, rowH).fill(colors.boxGray)
    doc.fillColor(colors.black).font('Helvetica').fontSize(12.5).text(label, m + 4, ry + 7)
    doc.text(String(val), m + w - 110, ry + 7, { width: 100, align: 'right' })
  })
  y += services.length * rowH + 14

  // Costing table
  doc.roundedRect(m, y, w, rowH, 3).fill(colors.red)
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(13).text('— : COSTING : —', m, y + 5, { width: w, align: 'center' })
  y += rowH + 4

  items.forEach((it, i) => {
    const ry = y + i * rowH
    if (i % 2 === 0) doc.rect(m, ry, w, rowH).fill(colors.boxGray)
    doc.fillColor(colors.black).font('Helvetica').fontSize(10.5).text((it.description || '').toUpperCase(), m + 4, ry + 6, { width: w - 110 })
    doc.text(formatInr(it.amount), m + w - 110, ry + 6, { width: 100, align: 'right' })
  })
  y += items.length * rowH
  doc.moveTo(m, y).lineTo(m + w, y).strokeColor(colors.grayLight).stroke()
  y += 4

  // This invoice's own amount (e.g. a Partial/Advance invoice's total is
  // just what that payment covers, not the whole trip) is shown separately
  // from the trip's real package cost and the running balance across every
  // invoice raised for this booking — so a Partial invoice never prints a
  // misleading "Total Package Cost" of just the partial amount.
  const packageAmount = packageTotal ?? invoice.totalAmount
  const received = totalReceivedOverall ?? invoice.amountPaid ?? 0

  const thisInvoiceRy = y
  doc.fillColor(colors.gray).font('Helvetica').fontSize(10).text('This Invoice Amount', m + 4, thisInvoiceRy + 5)
  doc
    .fillColor(colors.black)
    .font('Helvetica-Bold')
    .fontSize(10.5)
    .text(formatInr(invoice.totalAmount), m + w - 110, thisInvoiceRy + 5, { width: 100, align: 'right' })
  y += rowH - 3

  const packageRy = y
  doc.rect(m, packageRy, w, rowH).fill(colors.boxGray)
  doc.fillColor(colors.black).font('Helvetica-Bold').fontSize(10.5).text('TOTAL PACKAGE COST', m + 4, packageRy + 6)
  doc.text(formatInr(packageAmount), m + w - 110, packageRy + 6, { width: 100, align: 'right' })
  y += rowH

  const receivedRy = y
  doc.fillColor(colors.red).font('Helvetica').fontSize(10.5).text('TOTAL RECEIVED (All Payments)', m + 4, receivedRy + 6)
  doc.text(`-${formatInr(received)}`, m + w - 110, receivedRy + 6, { width: 100, align: 'right' })
  y += rowH

  const balance = Math.max(0, Number(packageAmount || 0) - Number(received || 0))
  doc.rect(m, y, w, rowH + 2).fill(colors.red)
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(13).text('BALANCE DUE', m + 4, y + 6)
  doc.text(formatInr(balance), m + w - 110, y + 6, { width: 100, align: 'right' })
  y += rowH + 20

  // Footer
  doc.rect(0, pageHeight - footerH, PAGE.width, footerH).fill(colors.red)
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(13).text('Thank You!', m, pageHeight - 62)
  doc.font('Helvetica').fontSize(9.5).text('Thank you for booking with us', m, pageHeight - 48)
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .text((brand.name || 'Travel Agency').toUpperCase(), 0, pageHeight - 62, { width: PAGE.width - m, align: 'right' })
  doc
    .fillColor('#ffffff')
    .opacity(0.85)
    .font('Helvetica-Oblique')
    .fontSize(8.5)
    .text('This is a system generated invoice, no need for stamp and signature.', m, pageHeight - 22, {
      width: w,
      align: 'center',
    })
    .opacity(1)

  doc.end()
  return done
}
