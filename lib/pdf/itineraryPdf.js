import { createRequire } from 'module'

const require = createRequire(import.meta.url)

function createPdfDocument(options) {
  const PDFDocument = require('pdfkit')
  return new PDFDocument(options)
}

// Each theme swaps only the accent palette — white/black/gray stay neutral
// across all of them. `colors` is threaded as an explicit parameter (never a
// shared module-level mutable) so concurrent PDF generations with different
// themes can never bleed into each other.
export const PDF_THEMES = [
  {
    id: 'classic',
    label: 'Classic Red',
    description: 'Bold red & orange — the signature look.',
    colors: {
      red: '#E4181F',
      redMid: '#C0121A',
      redDark: '#6E0C10',
      redSoft: '#F04A4F',
      orange: '#F5921E',
      yellow: '#F5A623',
      white: '#ffffff',
      black: '#000000',
      gray: '#6b7280',
      grayLight: '#e5e7eb',
      boxGray: '#eef1f6',
      exclusion: '#ffe9d6',
      supplement: '#fff6cc',
    },
  },
  {
    id: 'ocean',
    label: 'Ocean Blue',
    description: 'Calm blue & teal — a cooler, corporate feel.',
    colors: {
      red: '#1170B3',
      redMid: '#0D5A91',
      redDark: '#083A5E',
      redSoft: '#3B94D1',
      orange: '#14B8A6',
      yellow: '#38BDF8',
      white: '#ffffff',
      black: '#000000',
      gray: '#6b7280',
      grayLight: '#e5e7eb',
      boxGray: '#eef4f8',
      exclusion: '#dbeeff',
      supplement: '#e0f7f5',
    },
  },
  {
    id: 'emerald',
    label: 'Emerald Luxury',
    description: 'Deep green & gold — a premium, upscale feel.',
    colors: {
      red: '#0F7A4D',
      redMid: '#0B5C3A',
      redDark: '#073D26',
      redSoft: '#2FAE7A',
      orange: '#C9A227',
      yellow: '#E8C766',
      white: '#ffffff',
      black: '#000000',
      gray: '#6b7280',
      grayLight: '#e5e7eb',
      boxGray: '#eef7f1',
      exclusion: '#faf1d8',
      supplement: '#f2ecd9',
    },
  },
]

const DEFAULT_THEME = PDF_THEMES[0]

export function getThemeColors(themeId) {
  return (PDF_THEMES.find((t) => t.id === themeId) || DEFAULT_THEME).colors
}

const PAGE = { margin: 40, width: 595.28, height: 841.89 }
// The whole itinerary renders on ONE tall page. The cover and contact keep the
// A4 proportions as fixed-height bands; the day/hotel/pricing content flows in
// between them.
// Matches drawCover's actual content height (overview card at y=590, height
// 118, plus the 38px footer bar right below it) instead of a full A4 page —
// using the full page height here left a large unused red gap under the
// footer bar before the next section started.
const COVER_H = 746
const CONTACT_H = PAGE.height
const DEFAULT_BG = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80'
const DEFAULT_AMENITIES = [
  'Daily Breakfast',
  'Daily Dinner',
  'Free Wi-Fi',
  '24/7 Room Service',
  'Mineral Water',
  'Electric Blanket',
]

// PDFKit's doc.image() only understands JPEG and PNG — anything else (WebP,
// AVIF, etc. — common from Google Places photos) throws "Unknown image
// format" and, without this normalization, would silently blank out every
// section drawn after it (see the save/restore fix in sectionHotels).
function isJpegOrPng(buffer) {
  if (!buffer || buffer.length < 4) return false
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
  return isJpeg || isPng
}

async function normalizeImageBuffer(buffer) {
  if (!buffer || isJpegOrPng(buffer)) return buffer
  try {
    const sharp = require('sharp')
    return await sharp(buffer).jpeg({ quality: 82 }).toBuffer()
  } catch {
    return null
  }
}

export async function fetchImageBuffer(url) {
  if (!url) return null
  try {
    let buffer
    if (url.startsWith('data:')) {
      const base64 = url.split(',')[1] || ''
      buffer = base64 ? Buffer.from(base64, 'base64') : null
    } else {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      buffer = res.ok ? Buffer.from(await res.arrayBuffer()) : null
    }
    return await normalizeImageBuffer(buffer)
  } catch {
    return null
  }
}

function formatInr(amount) {
  // Standard PDF fonts can't render the ₹ glyph — use the "/-" convention.
  return `${Number(amount || 0).toLocaleString('en-IN')}/-`
}

function leadName(lead) {
  if (!lead || typeof lead !== 'object') return ''
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ')
}

function computeDuration(itinerary) {
  if (itinerary.duration) return itinerary.duration
  const { startDate, endDate } = itinerary
  if (startDate && endDate) {
    const nights = Math.round((new Date(endDate) - new Date(startDate)) / 86400000)
    if (nights > 0) return `${nights}N/${nights + 1}D`
  }
  return ''
}

function formatDate(d) {
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

// Draw the flowing middle content (day plan → hotels → pricing → info) starting
// at absolute `y`, and return the y just below it. Used both to MEASURE the
// content height and to render it for real, so the two stay perfectly in sync.
function drawContent(doc, { itinerary, days, hotels, hotelBuffers, colors }, y) {
  y = sectionDays(doc, { days, colors }, y)
  // Budget-tier itineraries (Multiple budget options toggle) interleave each
  // tier's hotel card(s) with that same tier's own pricing, so the client
  // sees "here's the High Budget hotel, here's what it costs" as one block,
  // then the same for Low Budget — instead of all hotels up top and both
  // tiers' totals stacked together at the bottom.
  if (itinerary.categoryTotals?.length > 1) {
    y = sectionHotelsAndPricingByTier(doc, { hotels, hotelBuffers, itinerary, colors }, y)
  } else {
    if (hotels.length) y = sectionHotels(doc, { hotels, hotelBuffers, itinerary, colors }, y)
    y = sectionPricing(doc, { itinerary, colors }, y)
  }
  y = sectionInfo(doc, { itinerary, colors }, y)
  return y
}

// Total nights booked at a given hotel — the longest room-line duration per
// matching stay, summed across every stay that hotel appears in.
function hotelNightsMap(itinerary) {
  const map = {}
  ;(itinerary.nightStays || []).forEach((stay) => {
    const key = stay.hotelName || stay.location || ''
    if (!key) return
    const lines = stay.roomLines?.length ? stay.roomLines : stay.roomType ? [{ nights: stay.nights }] : []
    const nights = Math.max(0, ...lines.map((l) => Number(l.nights) || 0))
    map[key] = (map[key] || 0) + nights
  })
  return map
}

// Mirrors the layout arithmetic in drawContact so we can size the contact
// band to its real content instead of a fixed full-page height.
function computeContactContentHeight(brand, scannerBuffer) {
  let y = 140
  const contact = [brand.phone, brand.email, brand.website].filter(Boolean).join(' | ')
  if (contact) y += 34
  const addresses = [brand.address, brand.address2].filter(Boolean)
  y += addresses.length * 54
  y += 24
  const bank = brand.bankDetails || {}
  const hasBank = bank.bankName || bank.accountNumber || bank.ifscCode
  if (hasBank || scannerBuffer) y += 168 + 28
  const socials = [
    brand.website ? 'Website' : null,
    brand.metaLink ? 'Instagram' : null,
    brand.metaLink ? 'Facebook' : null,
  ].filter(Boolean)
  if (socials.length) y += 28
  return y + 40 // bottom padding
}

export async function buildItineraryPdf({ itinerary, days = [], hotels = [], brand = {}, theme }) {
  const brandName = brand.name || 'Travel Agency'
  const colors = getThemeColors(theme)

  // Preload every image once — reused by both the measure and the render pass.
  // All of these are independent network fetches, so run them concurrently
  // instead of one-at-a-time (that alone was the biggest chunk of generation time).
  const gallery = (itinerary.gallery || []).filter(Boolean)
  const [imageBuffers, bgBuffer, logoBuffer, scannerBuffer, hotelBuffers] = await Promise.all([
    Promise.all(gallery.slice(0, 4).map((url) => fetchImageBuffer(url))),
    fetchImageBuffer(brand.contactBackground || gallery[0] || itinerary.bannerImage || DEFAULT_BG),
    fetchImageBuffer(brand.logo),
    fetchImageBuffer(brand.scanner1),
    Promise.all(hotels.map((h) => fetchImageBuffer((h.images || [])[0]))),
  ])

  // Pass 1 — measure the flowing content on a throwaway, very tall page so it
  // never wraps. Starting at y=0 makes the returned value the content height.
  const measureDoc = createPdfDocument({
    size: [PAGE.width, 30000],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  })
  const contentH = drawContent(measureDoc, { itinerary, days, hotels, hotelBuffers, colors }, 0)

  // One single page: cover band + gap + content + gap + contact band.
  const contactH = computeContactContentHeight(brand, scannerBuffer)
  const contentTop = COVER_H + PAGE.margin
  const contactTop = contentTop + contentH + PAGE.margin
  const totalH = contactTop + contactH

  return new Promise((resolve, reject) => {
    ;(async () => {
      try {
        const doc = createPdfDocument({
          size: [PAGE.width, totalH],
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          bufferPages: true,
          info: {
            Title: itinerary.customerName || itinerary.tripName || itinerary.title || 'Travel Itinerary',
            Author: brandName,
          },
        })

        const chunks = []
        doc.on('data', (chunk) => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        drawCover(doc, { itinerary, brand, imageBuffers, logoBuffer, colors }, 0)
        drawContent(doc, { itinerary, days, hotels, hotelBuffers, colors }, contentTop)
        drawContact(doc, { brand, bgBuffer, logoBuffer, scannerBuffer, colors }, contactTop, contactH)

        doc.end()
      } catch (err) {
        reject(err)
      }
    })()
  })
}

/* ----------------------------- Cover ----------------------------- */

function normalizeUrl(url) {
  if (!url) return url
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function coverBrandText(doc, brand, colors) {
  doc
    .fillColor(colors.red)
    .font('Helvetica-Bold')
    .fontSize(18)
    .text((brand.name || 'Travel Agency').toUpperCase(), 48, 60, { width: 134, align: 'center' })
}

function drawCover(doc, { itinerary, brand, imageBuffers, logoBuffer, colors }, top) {
  const w = doc.page.width
  const h = COVER_H
  // Draw in the cover's own coordinate space; the band sits at `top`.
  doc.save()
  doc.translate(0, top)

  const grad = doc.linearGradient(0, 0, w, h)
  grad.stop(0, colors.red).stop(0.55, colors.redMid).stop(1, colors.redDark)
  doc.rect(0, 0, w, h).fill(grad)

  // Logo box (top-left)
  doc.roundedRect(40, 42, 150, 56, 4).fill(colors.white)
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 48, 48, { fit: [134, 44], align: 'center', valign: 'center' })
    } catch {
      coverBrandText(doc, brand, colors)
    }
  } else {
    coverBrandText(doc, brand, colors)
  }
  doc.fillColor(colors.white).font('Helvetica').fontSize(12).text('Official Itinerary', 40, 104)

  // Explore + destination
  doc.fillColor(colors.orange).font('Helvetica-Oblique').fontSize(28).text('Explore', 40, 138)
  doc
    .fillColor(colors.white)
    .font('Helvetica-Bold')
    .fontSize(44)
    .text((itinerary.destination || 'YOUR TRIP').toUpperCase(), 40, 170, { width: 250, lineGap: 2 })

  // Diamond gallery (right) — cascading rounded diamonds down the right edge,
  // with a small, even gap between each. `y` on the first card is pushed down
  // enough that its rotated top tip clears the page edge instead of touching it.
  const positions = [
    { x: 379, y: 66, size: 148 },
    { x: 290, y: 188, size: 135 },
    { x: 387, y: 297, size: 144 },
    { x: 290, y: 416, size: 135 },
  ]
  const loaded = imageBuffers.filter(Boolean)
  positions.forEach((p, i) => {
    // Fill empty slots with another loaded image so no red block shows.
    const buf = imageBuffers[i] || (loaded.length ? loaded[i % loaded.length] : null)
    if (buf) drawDiamondImage(doc, buf, p.x, p.y, p.size, colors)
    else drawDiamondPlaceholder(doc, p.x, p.y, p.size, colors)
  })

  // Duration / category ribbon (left edge)
  const duration = computeDuration(itinerary)
  const category = itinerary.packageCategory || ''
  if (duration || category) {
    const by = 322
    doc.save()
    doc
      .moveTo(0, by)
      .lineTo(150, by)
      .lineTo(172, by + 26)
      .lineTo(150, by + 52)
      .lineTo(0, by + 52)
      .closePath()
      .fill(colors.orange)
    doc.restore()
    if (duration) doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(20).text(duration, 26, by + 8, { width: 124 })
    if (category) doc.fillColor(colors.white).font('Helvetica').fontSize(12).text(category, 26, by + 33, { width: 124 })
  }

  // Client name — sits just below the duration/category ribbon.
  const client = itinerary.customerName || leadName(itinerary.leadId)
  if (client) {
    const clientY = (duration || category ? 322 + 52 : 322) + 16 + 50
    doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(15).text('Name :-  ', 10, clientY, { continued: true })
    doc.fillColor(colors.orange).text(client.toUpperCase())
  }

  // Package overview (full-width white strip) — extra top/bottom padding
  // around the heading and paragraph so the text doesn't crowd the card edges.
  // Starts right below the lowest diamond image (last diamond's rotated
  // bottom tip sits at ~y=579) instead of being pinned to the page bottom,
  // which used to leave a large empty red gap above it.
  const cardH = 118
  const cardY = 590
  doc.rect(0, cardY, w, cardH).fill(colors.white)
  doc.fillColor(colors.black).font('Helvetica-Bold').fontSize(16.5).text('Package Overview', 40, cardY + 18)
  const overview =
    itinerary.marketingOverview ||
    'Crafted for guests seeking premium comfort and exclusive services.'
  doc
    .fillColor(colors.black)
    .font('Helvetica')
    .fontSize(12)
    .text(overview.slice(0, 360), 40, cardY + 42, { width: w - 80, align: 'justify', lineGap: 2.5 })

  // Footer bar — sits directly below the overview card, no leftover red gap.
  const footer = [brand.phone, brand.website, (brand.name || '').toUpperCase()]
    .filter(Boolean)
    .join('        ')
  const footerY = cardY + cardH
  doc.rect(0, footerY, w, 38).fill(colors.redDark)
  if (footer) {
    doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(11).text(footer, 40, footerY + 13, { width: w - 80, align: 'center' })
  }

  doc.restore()
}

function drawDiamondImage(doc, buffer, cx, cy, size, colors) {
  const half = size / 2
  const radius = size * 0.075
  doc.save()
  doc.translate(cx + half, cy + half)
  doc.rotate(45)

  // Clip to the rounded square, then draw the photo scaled like CSS
  // object-cover (crop to fill, no letterboxing) using its real aspect
  // ratio — a plain `fit` box would squash/underfill non-square photos and
  // is what made every diamond look like a different, uneven shape.
  doc.save()
  doc.roundedRect(-half, -half, size, size, radius).clip()
  try {
    const img = doc.openImage(buffer)
    const scale = Math.max(size / img.width, size / img.height)
    const w = img.width * scale
    const h = img.height * scale
    doc.image(buffer, -w / 2, -h / 2, { width: w, height: h })
  } catch {
    doc.rect(-half, -half, size, size).fill(colors.redDark)
  }
  doc.restore()

  doc.roundedRect(-half, -half, size, size, radius).lineWidth(2).strokeColor(colors.white).stroke()
  doc.restore()
}

function drawDiamondPlaceholder(doc, cx, cy, size, colors) {
  const half = size / 2
  const radius = size * 0.075
  doc.save()
  doc.translate(cx + half, cy + half)
  doc.rotate(45)
  doc.roundedRect(-half, -half, size, size, radius).fill(colors.redDark)
  doc.roundedRect(-half, -half, size, size, radius).lineWidth(2).strokeColor(colors.white).stroke()
  doc.restore()
}

/* --------------------------- Day wise --------------------------- */

// Single-page layout: content never breaks across pages, so this is a no-op
// kept only so the section functions read the same as before.
function ensureSpace(doc, y) {
  return y
}

// Centered section title with a short red underline. Returns the y below it.
function sectionTitle(doc, title, y, colors) {
  const m = PAGE.margin
  const cw = doc.page.width - m * 2
  doc.fillColor(colors.black).font('Helvetica-Bold').fontSize(16).text(title, m, y, { width: cw, align: 'center' })
  doc.rect(doc.page.width / 2 - 22, y + 22, 44, 3).fill(colors.red)
  return y + 40
}

function sectionDays(doc, { days, colors }, y) {
  const m = PAGE.margin
  const cw = doc.page.width - m * 2
  y = ensureSpace(doc, y, 90)
  y = sectionTitle(doc, 'DAY WISE PLAN', y, colors)

  const list = days.length ? days : [{ dayNumber: 1, title: 'ARRIVAL', description: '' }]
  list.forEach((day) => {
    y = ensureSpace(doc, y, 70)
    y += drawDayRow(doc, day, m, y, cw, colors) + 22
  })
  return y + 16
}

function drawDayRow(doc, day, x, y, w, colors) {
  doc.roundedRect(x, y - 4, w, 33, 6).fill(colors.boxGray)
  doc.roundedRect(x, y, 68, 25, 12).fill(colors.red)
  doc
    .fillColor(colors.white)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(`Day ${day.dayNumber}`, x, y + 8, { width: 68, align: 'center' })

  const titleX = x + 78
  const titleW = w - 78 - 100
  doc
    .fillColor(colors.black)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text((day.title || `Day ${day.dayNumber}`).toUpperCase(), titleX, y + 5, { width: titleW })

  if (day.date) {
    doc
      .fillColor(colors.black)
      .font('Helvetica')
      .fontSize(9.5)
      .text(formatDate(day.date), x + w - 100, y + 8, { width: 100, align: 'right' })
  }

  let dy = Math.max(doc.y, y + 27) + 5

  // Distance/duration are now entered as plain numbers (km / hours) — append
  // the unit here. Older itineraries may still have free-text values (e.g.
  // "45-50 km") saved from before that restriction, so only append when the
  // value is purely numeric to avoid doubling up the unit.
  const isPlainNumber = (v) => /^\d+(\.\d+)?$/.test(String(v || '').trim())
  const distanceText = day.distance ? `DISTANCE  ${day.distance}${isPlainNumber(day.distance) ? ' km' : ''}` : ''
  const timeText = day.travelDuration
    ? `TIME  ${day.travelDuration}${isPlainNumber(day.travelDuration) ? ' hrs' : ''}`
    : ''
  if (distanceText || timeText) {
    doc.fillColor('#374151').font('Helvetica-Bold').fontSize(8.5)
    if (distanceText) doc.text(distanceText, x, dy, { width: w / 2, align: 'left' })
    if (timeText) doc.text(timeText, x + w / 2, dy, { width: w / 2, align: 'right' })
    dy += 15
  }

  if (day.description) {
    doc.fillColor(colors.black).font('Helvetica').fontSize(13).text(day.description, x, dy, { width: w, lineGap: 3 })
    dy = doc.y + 5
  }

  return Math.max(34, dy - y)
}

/* ---------------------------- Hotels ---------------------------- */

function drawStar(doc, cx, cy, r, color) {
  const pts = []
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2
    const rad = i % 2 === 0 ? r : r * 0.45
    pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad])
  }
  doc.save().fillColor(color)
  doc.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) doc.lineTo(pts[i][0], pts[i][1])
  doc.closePath().fill()
  doc.restore()
}

function drawStars(doc, x, y, n, colors) {
  const count = Math.min(5, Math.max(0, Number(n) || 3))
  for (let i = 0; i < count; i++) drawStar(doc, x + 6 + i * 13, y + 5, 5, colors.orange)
}

function drawHotelCard(doc, { h, buffer, itinerary, colors, m, cw }, y) {
  const nightsByHotel = hotelNightsMap(itinerary)
  const amenities = h.amenities?.length ? h.amenities : DEFAULT_AMENITIES
  const amenityRows = Math.max(3, Math.ceil(amenities.length / 2))
  const cardH = Math.max(112, 50 + amenityRows * 15 + 26)
  y = ensureSpace(doc, y, 32 + cardH + 16)

  // Red header bar
  doc.roundedRect(m, y, cw, 27, 4).fill(colors.red)
  doc
    .fillColor(colors.white)
    .font('Helvetica-Bold')
    .fontSize(13.5)
    .text(`STAY IN ${(h.location || h.name || '').toUpperCase()}`, m + 12, y + 8)
  const nights = nightsByHotel[h.name] || nightsByHotel[h.location] || 0
  if (nights) {
    doc
      .fillColor(colors.white)
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(`${nights} NIGHT${nights > 1 ? 'S' : ''}`, m, y + 8, { width: cw - 12, align: 'right' })
  }
  y += 35

  // Card
  doc.roundedRect(m, y, cw, cardH, 6).fill(colors.boxGray)
  const imgW = 155
  const imgX = m + cw - imgW - 8
  if (buffer) {
    doc.save()
    try {
      doc.roundedRect(imgX, y + 8, imgW, cardH - 16, 4).clip()
      doc.image(buffer, imgX, y + 8, { width: imgW, height: cardH - 16, align: 'center', valign: 'center' })
    } catch {
      // Clip is still active here, so this fill is scoped to the image box —
      // the crucial part is the restore() below always running afterward.
      doc.roundedRect(imgX, y + 8, imgW, cardH - 16, 4).fill(colors.grayLight)
    } finally {
      doc.restore()
    }
  } else {
    doc.roundedRect(imgX, y + 8, imgW, cardH - 16, 4).fill(colors.grayLight)
  }

  doc.fillColor(colors.red).font('Helvetica-Bold').fontSize(12).text(h.name || 'Hotel', m + 12, y + 12, { width: cw - imgW - 40 })
  drawStars(doc, m + 12, doc.y + 4, h.stars || 3, colors)

  let ay = y + 52
  doc.fillColor(colors.black).font('Helvetica-Bold').fontSize(10).text('AMENITIES', m + 12, ay)
  ay += 15

  const colW = (cw - imgW - 40) / 2
  amenities.forEach((a, idx) => {
    const col = idx % 2
    const row = Math.floor(idx / 2)
    const ax = m + 12 + col * colW
    const ry = ay + row * 15
    doc.circle(ax + 3, ry + 5, 2).fill(colors.red)
    doc.fillColor(colors.black).font('Helvetica').fontSize(9).text(a, ax + 10, ry, { width: colW - 14 })
  })

  return y + cardH + 16
}

/** Budget-tier category values are 'high' / 'low' (from the Hotels/Costing
 * steps' Multiple budget options toggle); this turns one into its PDF label. */
function tierLabel(category) {
  if (category === 'high') return 'High Budget'
  if (category === 'low') return 'Low Budget'
  return String(category || '').toUpperCase()
}

function drawTierHeader(doc, label, m, cw, colors, y) {
  y = ensureSpace(doc, y, 34)
  doc.roundedRect(m, y, cw, 26, 5).fill(colors.black)
  doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(10).text(label, m + 12, y + 6)
  return y + 34
}

function sectionHotels(doc, { hotels, hotelBuffers, itinerary, colors }, y) {
  const m = PAGE.margin
  const cw = doc.page.width - m * 2
  y = ensureSpace(doc, y, 100)
  y = sectionTitle(doc, 'HOTEL DETAILS', y, colors)
  hotels.forEach((h, i) => {
    y = drawHotelCard(doc, { h, buffer: hotelBuffers[i], itinerary, colors, m, cw }, y)
  })
  return y + 6
}

// The tier for a hotel is resolved from its matching night stay (the same
// source the per-tier totals are computed from), not the hotel record's own
// `category` — that field can end up stale/unset if the same hotel was ever
// picked under both tiers, which would otherwise make this section disagree
// with the totals shown for it.
function nightStayCategoryFor(itinerary, h) {
  const stay = (itinerary.nightStays || []).find(
    (s) => (h.id && String(s.hotelId) === String(h.id)) || (s.hotelName && s.hotelName === h.name)
  )
  return stay?.category ?? h.category
}

function roomLinesFromNightStays(itinerary) {
  return (itinerary.nightStays || []).flatMap((stay) => {
    const lines = stay.roomLines?.length
      ? stay.roomLines
      : stay.roomType
        ? [{ roomType: stay.roomType, roomCount: stay.rooms, nights: stay.nights }]
        : []
    return lines
      .filter((l) => l.roomType)
      .map((l) => ({
        hotelName: stay.hotelName || stay.location || '',
        category: stay.category,
        roomType: l.roomType,
        roomCount: Number(l.roomCount) || 1,
        nights: Number(l.nights) || 0,
      }))
  })
}

/** Budget-tier itineraries: shared trip info once, then for each tier — its
 * own hotel card(s), its own room-type rows, and its own total — as one
 * self-contained block per package option, so a client can compare "High
 * Budget: this hotel, this price" against "Low Budget: this hotel, this
 * price" without hunting across two separate sections. */
function sectionHotelsAndPricingByTier(doc, { hotels, hotelBuffers, itinerary, colors }, y) {
  const m = PAGE.margin
  const cw = doc.page.width - m * 2
  y = ensureSpace(doc, y, 120)
  y = sectionTitle(doc, 'HOTEL DETAILS & PRICING', y, colors)

  y = drawSectionHeader(doc, 'Trip Overview', m, y, colors.red, colors)
  y += 4

  const travelers =
    itinerary.numberOfTravelers ||
    (Number(itinerary.numberOfAdults) || 0) + (Number(itinerary.numberOfChildren) || 0)

  y = drawPriceRow(doc, m, cw, y, 'Total Travelers', `${travelers || 0} PAX`, colors)
  y = drawPriceRow(doc, m, cw, y, 'Adult Guest', String(itinerary.numberOfAdults ?? 0), colors)
  if (itinerary.numberOfChildren > 0) y = drawPriceRow(doc, m, cw, y, 'Children', String(itinerary.numberOfChildren), colors)
  if (itinerary.extraBeds > 0) y = drawPriceRow(doc, m, cw, y, 'Extra Bed', String(itinerary.extraBeds), colors)
  if (itinerary.cnbCount > 0) y = drawPriceRow(doc, m, cw, y, 'CNB', String(itinerary.cnbCount), colors)

  const vehicleLines = itinerary.vehicles?.length
    ? itinerary.vehicles
    : itinerary.vehicle
      ? [{ name: itinerary.vehicle, ...(itinerary.vehicleDetails || {}) }]
      : []
  vehicleLines.forEach((v) => {
    const route = [v.fromLocation, v.toLocation].filter(Boolean).join(' ')
    y = drawSubLabelPriceRow(doc, m, cw, y, 'Vehicle', route ? `Pickup/Drop:- ${route}` : '', v.name || '-', colors)
  })

  const roomLines = roomLinesFromNightStays(itinerary)
  const order = ['low', 'high']
  const ordered = order.map((key) => itinerary.categoryTotals.find((c) => c.category === key)).filter(Boolean)
  const indices = hotels.map((_, i) => i)

  ordered.forEach(({ category, total: catTotal }) => {
    y += 6
    y = drawTierHeader(doc, `${tierLabel(category)} PACKAGE`, m, cw, colors, y)

    indices
      .filter((i) => nightStayCategoryFor(itinerary, hotels[i]) === category)
      .forEach((i) => {
        y = drawHotelCard(doc, { h: hotels[i], buffer: hotelBuffers[i], itinerary, colors, m, cw }, y)
      })

    roomLines
      .filter((l) => l.category === category)
      .forEach((l) => {
        const value = [l.roomCount ? `${l.roomCount} room${l.roomCount > 1 ? 's' : ''}` : null, l.nights ? `${l.nights}N` : null]
          .filter(Boolean)
          .join(' · ')
        y = drawSubLabelPriceRow(doc, m, cw, y, l.hotelName || 'Room', l.roomType ? `Room Type:- ${l.roomType}` : '', value || '-', colors)
      })

    y = drawPriceRow(
      doc,
      m,
      cw,
      y,
      `Total Package Cost — ${tierLabel(category)}`,
      catTotal > 0 ? formatInr(catTotal) : 'Price on Request',
      colors
    )
  })

  return y + 14
}

/* ---------------------------- Pricing --------------------------- */

function drawPriceRow(doc, m, cw, y, label, value, colors) {
  const rowH = 38
  y = ensureSpace(doc, y, rowH + 6)
  doc.roundedRect(m + 16, y, cw - 32, rowH, 8).stroke(colors.grayLight)
  drawLeafIcon(doc, m + 4, y + 13, colors)
  drawLeafIcon(doc, m + cw - 12, y + 13, colors)
  doc.fillColor(colors.black).font('Helvetica').fontSize(10).text(label, m + 28, y + 13, { width: cw / 2 })
  doc
    .fillColor(colors.red)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(value, m + cw / 2, y + 12, { width: cw / 2 - 40, align: 'right' })
  return y + rowH + 6
}

// Same card as drawPriceRow but the label is two lines — a main label, then
// a sub-line 20% smaller and gray underneath it (e.g. "Room Type:- Deluxe"
// or "Pickup/Drop:- Jammu to Jammu").
function drawSubLabelPriceRow(doc, m, cw, y, mainLabel, subLabel, value, colors) {
  const rowH = subLabel ? 50 : 38
  y = ensureSpace(doc, y, rowH + 6)
  doc.roundedRect(m + 16, y, cw - 32, rowH, 8).stroke(colors.grayLight)
  drawLeafIcon(doc, m + 4, y + rowH / 2 - 6, colors)
  drawLeafIcon(doc, m + cw - 12, y + rowH / 2 - 6, colors)
  doc.fillColor(colors.black).font('Helvetica').fontSize(10).text(mainLabel, m + 28, y + 10, { width: cw / 2 })
  if (subLabel) {
    doc.fillColor(colors.gray).font('Helvetica').fontSize(8).text(subLabel, m + 28, y + 26, { width: cw / 2 })
  }
  doc
    .fillColor(colors.red)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(value, m + cw / 2, y + rowH / 2 - 6, { width: cw / 2 - 40, align: 'right' })
  return y + rowH + 6
}

function sectionPricing(doc, { itinerary, colors }, y) {
  const m = PAGE.margin
  const cw = doc.page.width - m * 2
  y = ensureSpace(doc, y, 120)
  y = sectionTitle(doc, 'PRICING & STAY', y, colors)

  y = drawSectionHeader(doc, 'Tour Package Pricing', m, y, colors.red, colors)
  y += 4

  const travelers =
    itinerary.numberOfTravelers ||
    (Number(itinerary.numberOfAdults) || 0) + (Number(itinerary.numberOfChildren) || 0)
  const total = Number(itinerary.totalPrice ?? itinerary.totalCost ?? 0)

  y = drawPriceRow(doc, m, cw, y, 'Total Travelers', `${travelers || 0} PAX`, colors)
  y = drawPriceRow(doc, m, cw, y, 'Adult Guest', String(itinerary.numberOfAdults ?? 0), colors)
  if (itinerary.numberOfChildren > 0) y = drawPriceRow(doc, m, cw, y, 'Children', String(itinerary.numberOfChildren), colors)
  if (itinerary.extraBeds > 0) y = drawPriceRow(doc, m, cw, y, 'Extra Bed', String(itinerary.extraBeds), colors)
  if (itinerary.cnbCount > 0) y = drawPriceRow(doc, m, cw, y, 'CNB', String(itinerary.cnbCount), colors)

  // Which room types and vehicles were taken — no per-item prices, the total row below already covers cost.
  const roomLines = roomLinesFromNightStays(itinerary)
  roomLines.forEach((l) => {
    const value = [l.roomCount ? `${l.roomCount} room${l.roomCount > 1 ? 's' : ''}` : null, l.nights ? `${l.nights}N` : null]
      .filter(Boolean)
      .join(' · ')
    y = drawSubLabelPriceRow(doc, m, cw, y, l.hotelName || 'Room', l.roomType ? `Room Type:- ${l.roomType}` : '', value || '-', colors)
  })

  const vehicleLines = itinerary.vehicles?.length
    ? itinerary.vehicles
    : itinerary.vehicle
      ? [{ name: itinerary.vehicle, ...(itinerary.vehicleDetails || {}) }]
      : []

  vehicleLines.forEach((v) => {
    const route = [v.fromLocation, v.toLocation].filter(Boolean).join(' ')
    y = drawSubLabelPriceRow(doc, m, cw, y, 'Vehicle', route ? `Pickup/Drop:- ${route}` : '', v.name || '-', colors)
  })

  y = drawPriceRow(doc, m, cw, y, 'Total Package Cost', total > 0 ? formatInr(total) : 'Price on Request', colors)

  return y + 14
}

function drawLeafIcon(doc, x, y, colors) {
  // Red diamond (rotated square) — matches the reference pricing decoration.
  doc.save()
  doc.translate(x, y)
  doc.rotate(45)
  doc.rect(-5, -5, 10, 10).fill(colors.red)
  doc.restore()
}

/* ----------------------------- Info ----------------------------- */

function sectionInfo(doc, { itinerary, colors }, y) {
  const m = PAGE.margin
  const cw = doc.page.width - m * 2
  y = ensureSpace(doc, y, 120)
  y = sectionTitle(doc, 'INCLUSIONS & POLICIES', y, colors)

  // Inclusion is always green (a universal "included/positive" color) rather
  // than the theme's red, which is reserved for Excludes — otherwise both
  // sections would use the same red accent and read as contradictory.
  const sections = [
    { title: 'Inclusion', items: itinerary.inclusions, color: '#15803D', bg: '#dcfce7' },
    { title: 'Excludes', items: itinerary.exclusions, color: colors.orange, bg: colors.exclusion },
    { title: 'Supplement Cost', items: itinerary.supplements, color: colors.yellow, bg: colors.supplement },
  ]

  sections.forEach((sec) => {
    const items = (sec.items || []).filter(Boolean)
    if (!items.length) return
    y = ensureSpace(doc, y, 90)
    y = drawColoredListSection(doc, sec.title, items, m, y, cw, sec.color, sec.bg, colors)
    y += 12
  })

  const terms = (itinerary.termsAndConditions || '').split('\n').filter(Boolean)
  if (terms.length) {
    y = ensureSpace(doc, y, 90)
    y = drawSectionHeader(doc, 'Terms & Conditions', m, y, colors.gray, colors)
    terms.forEach((t) => {
      y = ensureSpace(doc, y, 18)
      doc.circle(m + 4, y + 6, 2).fill(colors.red)
      doc.fillColor(colors.black).font('Helvetica').fontSize(9.5).text(t, m + 14, y, { width: cw - 16 })
      y = doc.y + 6
    })
    y += 10
  }

  const cancellation = itinerary.cancellationPolicy || []
  if (cancellation.length) {
    y = ensureSpace(doc, y, 90)
    y = drawSectionHeader(doc, 'Cancellation Policy', m, y, colors.red, colors)
    cancellation.forEach((t) => {
      y = ensureSpace(doc, y, 18)
      doc.circle(m + 4, y + 6, 2).fill(colors.red)
      doc.fillColor(colors.black).font('Helvetica').fontSize(9.5).text(t, m + 14, y, { width: cw - 16 })
      y = doc.y + 6
    })
  }
  return y
}

/* --------------------------- Shared UI -------------------------- */

function drawSectionHeader(doc, title, x, y, accent, colors) {
  doc.rect(x, y, 3, 18).fill(accent)
  doc.fillColor(colors.black).font('Helvetica-Bold').fontSize(12.5).text(title, x + 10, y + 1)
  return y + 27
}

function drawColoredListSection(doc, title, items, x, y, w, accent, bg, colors) {
  y = drawSectionHeader(doc, title, x, y, accent, colors)
  items.forEach((item) => {
    const fontSize = 9.5
    const textH = doc.heightOfString(item, { width: w - 32, fontSize })
    const barH = Math.max(28, textH + 14)
    doc.roundedRect(x, y, w, barH, 6).fill(bg)
    doc.circle(x + 12, y + barH / 2, 2.5).fill(accent)
    doc.fillColor(colors.black).font('Helvetica').fontSize(fontSize).text(item, x + 22, y + 8, { width: w - 34 })
    y += barH + 6
  })
  return y
}

/* ---------------------------- Contact --------------------------- */

function drawContact(doc, { brand, bgBuffer, logoBuffer, scannerBuffer, colors }, top, h) {
  const w = doc.page.width
  // Draw in the contact band's own coordinate space; the band sits at `top`.
  doc.save()
  doc.translate(0, top)

  if (bgBuffer) {
    try {
      doc.image(bgBuffer, 0, 0, { width: w, height: h })
    } catch {
      doc.rect(0, 0, w, h).fill(colors.redDark)
    }
  } else {
    doc.rect(0, 0, w, h).fill(colors.redDark)
  }
  doc.rect(0, 0, w, h).fillOpacity(0.62).fill(colors.redMid)
  doc.fillOpacity(1)

  const brandName = brand.name || 'Travel Agency'
  doc.roundedRect(w / 2 - 90, 55, 180, 62, 6).fill(colors.white)
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, w / 2 - 80, 62, { fit: [160, 48], align: 'center', valign: 'center' })
    } catch {
      doc.fillColor(colors.red).font('Helvetica-Bold').fontSize(12).text(brandName.toUpperCase(), w / 2 - 80, 78, { width: 160, align: 'center' })
    }
  } else {
    doc.fillColor(colors.red).font('Helvetica-Bold').fontSize(12).text(brandName.toUpperCase(), w / 2 - 80, 78, { width: 160, align: 'center' })
  }

  // Everything below flows sequentially with consistent gaps — no more giant
  // empty red space in the middle of the page.
  let y = 140

  const contact = [brand.phone, brand.email, brand.website].filter(Boolean).join('    |    ')
  if (contact) {
    doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(10).text(contact, 40, y, { width: w - 80, align: 'center' })
    y += 34
  }

  // Address pills (with location-pin style marker)
  const addresses = [brand.address, brand.address2].filter(Boolean)
  addresses.forEach((addr) => {
    doc.roundedRect(50, y, w - 100, 42, 21).fill(colors.white)
    doc.circle(72, y + 21, 13).fill(colors.red)
    doc.circle(72, y + 18, 4).fill(colors.white)
    doc.moveTo(72, y + 20).lineTo(68, y + 27).lineTo(76, y + 27).closePath().fill(colors.white)
    doc.fillColor(colors.black).font('Helvetica-Bold').fontSize(10).text(addr, 94, y + 12, { width: w - 155 })
    y += 54
  })

  y += 24

  // Combined Bank + Scan-to-Pay card (side by side, like the reference)
  const bank = brand.bankDetails || {}
  const hasBank = bank.bankName || bank.accountNumber || bank.ifscCode
  if (hasBank || scannerBuffer) {
    const qr = scannerBuffer ? 150 : 0
    const cardH = scannerBuffer ? 210 : 168
    const qrColW = scannerBuffer ? 162 : 0
    doc.roundedRect(50, y, w - 100, cardH, 12).fill(colors.white)

    if (hasBank) {
      doc.fillColor(colors.black).font('Helvetica-Bold').fontSize(12).text('BANK ACCOUNTS & PAY', 70, y + 18, { width: w - 100 - qrColW - 40 })
      const rows = [
        ['Bank', bank.bankName],
        ['Account Name', bank.accountName || brandName],
        ['Account No', bank.accountNumber],
        ['IFSC Code', bank.ifscCode],
      ].filter(([, v]) => v)
      let by = y + 50
      rows.forEach(([label, value]) => {
        doc.fillColor(colors.red).font('Helvetica').fontSize(9).text(label, 70, by, { width: 100 })
        doc.fillColor(colors.black).font('Helvetica-Bold').fontSize(10).text(value, 70, by + 13, { width: w - 100 - qrColW - 40 })
        by += 28
      })
    }

    if (scannerBuffer) {
      const qx = w - 50 - qrColW + (qrColW - qr) / 2
      doc.fillColor(colors.black).font('Helvetica-Bold').fontSize(10.5).text('SCAN TO PAY', w - 50 - qrColW, y + 18, { width: qrColW, align: 'center' })
      const qy = y + 36
      try {
        doc.image(scannerBuffer, qx, qy, { fit: [qr, qr] })
      } catch {}
    }

    y += cardH + 28
  }

  // Social buttons — light pill style with a small icon circle, placed right
  // after the content flow (not stuck to the bottom of the page). Each button
  // is a clickable link to the real URL.
  const socials = [
    brand.website ? { label: 'Website', url: normalizeUrl(brand.website) } : null,
    brand.metaLink ? { label: 'Instagram', url: normalizeUrl(brand.metaLink) } : null,
    brand.metaLink ? { label: 'Facebook', url: normalizeUrl(brand.metaLink) } : null,
  ].filter(Boolean)
  if (socials.length) {
    const bw = 108
    const gap = 12
    const bh = 28
    const totalW = socials.length * bw + (socials.length - 1) * gap
    let bx = (w - totalW) / 2
    const byy = Math.min(y, h - 44)
    socials.forEach(({ label, url }) => {
      doc.roundedRect(bx, byy, bw, bh, 14).fill(colors.white)
      doc.circle(bx + 18, byy + bh / 2, 7).fill(colors.red)
      doc.fillColor(colors.black).font('Helvetica-Bold').fontSize(9).text(label, bx + 30, byy + 9, { width: bw - 36 })
      if (url) doc.link(bx, byy, bw, bh, url)
      bx += bw + gap
    })
  }

  doc.restore()
}
