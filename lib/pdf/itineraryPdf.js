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

// Day descriptions let the agent bold a phrase or two (**like this**) from the
// Itinerary Builder's editor toolbar. PDFKit has no rich-text run — this
// splits on the markers and re-joins the plain/bold pieces as one wrapped
// paragraph via `continued` text, switching font per piece.
function drawRichText(doc, text, x, y, options = {}) {
  const { font = 'Helvetica', boldFont = 'Helvetica-Bold', ...rest } = options
  const pieces = String(text || '')
    .split(/\*\*(.+?)\*\*/g)
    .map((t, i) => ({ text: t, bold: i % 2 === 1 }))
    .filter((p) => p.text.length > 0)

  if (pieces.length === 0) {
    doc.font(font).text('', x, y, rest)
    return
  }
  pieces.forEach((piece, i) => {
    const isFirst = i === 0
    const isLast = i === pieces.length - 1
    doc.font(piece.bold ? boldFont : font)
    doc.text(piece.text, isFirst ? x : undefined, isFirst ? y : undefined, { ...rest, continued: !isLast })
  })
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
  // No uploaded gallery photos → fall back to the banner (or a stock shot) so
  // the cover's diamond slots never render empty/placeholder red shapes.
  const gallery = (itinerary.gallery || []).filter(Boolean)
  const galleryFallback = gallery.length ? gallery : [itinerary.bannerImage || DEFAULT_BG]
  const [imageBuffers, bgBuffer, logoBuffer, scannerBuffer, hotelBuffers, dayBuffers] = await Promise.all([
    Promise.all(galleryFallback.slice(0, 4).map((url) => fetchImageBuffer(url))),
    fetchImageBuffer(brand.contactBackground || gallery[0] || itinerary.bannerImage || DEFAULT_BG),
    fetchImageBuffer(brand.logo),
    fetchImageBuffer(brand.scanner1),
    Promise.all(hotels.map((h) => fetchImageBuffer((h.images || [])[0]))),
    // Only Ocean Blue's day-wise timeline shows a per-day photo — skip the
    // fetch entirely for the other themes.
    theme === 'ocean' ? Promise.all(days.map((d) => fetchImageBuffer((d.images || [])[0]))) : Promise.resolve([]),
  ])

  // Ocean Blue is a completely separate, dedicated premium single-page
  // editorial layout (its own hero collage, typography, and section
  // designs) — Classic and Emerald keep the original engine below untouched.
  if (theme === 'ocean') {
    return buildOceanLuxuryPdf({ itinerary, days, hotels, brand, brandName, imageBuffers, hotelBuffers, dayBuffers, bgBuffer, logoBuffer })
  }

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
    doc.fillColor(colors.black).fontSize(13)
    drawRichText(doc, day.description, x, dy, { width: w, lineGap: 3, align: 'justify' })
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

/* =============================================================
 * OCEAN BLUE — premium ONE-PAGE luxury editorial layout.
 * A dedicated rendering path (single continuous page, exactly 4
 * images — all in the hero, serif/sans hierarchy, generous
 * spacing) used ONLY when theme === 'ocean'. Mirrors the same
 * visual language as the public itinerary web page. Classic and
 * Emerald never touch anything below this line.
 * ============================================================= */

const OCEAN = {
  blue: '#087EA4',
  deep: '#063B4C',
  navy: '#062F3C',
  light: '#EAF8FC',
  cyan: '#36BFE8',
  white: '#ffffff',
  text: '#173943',
  textSecondary: '#60777F',
  border: '#D7EAF0',
}

const OM = 48 // premium, generous margin
const OCW = PAGE.width - OM * 2
const OHERO_H = 508

function oceanEyebrow(doc, text, x, y) {
  doc.rect(x, y + 3, 18, 2).fill(OCEAN.blue)
  doc
    .fillColor(OCEAN.blue)
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .text(text.toUpperCase(), x + 26, y, { width: OCW - 26, characterSpacing: 1.2 })
  return y + 22
}

function oceanHeading(doc, text, x, y, size = 24) {
  doc.fillColor(OCEAN.navy).font('Times-Bold').fontSize(size).text(text, x, y, { width: OCW })
  return doc.y
}

function oceanRule(doc, x, y, w = OCW, color = OCEAN.border) {
  doc.rect(x, y, w, 1).fill(color)
}

function oceanCheckIcon(doc, x, y, color) {
  doc.save().lineWidth(1.4).strokeColor(color)
  doc.moveTo(x, y + 4).lineTo(x + 3.2, y + 7.2).lineTo(x + 9, y).stroke()
  doc.restore()
}

function oceanCrossIcon(doc, x, y, color) {
  doc.save().lineWidth(1.3).strokeColor(color)
  doc.moveTo(x, y).lineTo(x + 7, y + 7).stroke()
  doc.moveTo(x + 7, y).lineTo(x, y + 7).stroke()
  doc.restore()
}

function oceanDotIcon(doc, x, y, color) {
  doc.circle(x, y, 2.4).fill(color)
}

/* ---------------------------- Hero collage -------------------------- */

// Exactly four images, all here — one large primary photo (left) beside
// three smaller supporting photos stacked evenly (right), a connected
// editorial collage rather than a random grid.
function drawOceanHero(doc, { itinerary, brand, images }, top, h) {
  const w = PAGE.width
  doc.save()
  doc.translate(0, top)
  doc.rect(0, 0, w, h).fill(OCEAN.white)

  const bigW = OCW * 0.62
  const smallW = OCW - bigW - 14
  const bigX = OM
  const smallX = OM + bigW + 14
  const imgTop = 26 // clean breathing room above the collage — images never touch the top edge
  const imgH = 250

  // Exactly four photo slots — cycle through whatever real images the
  // itinerary actually has (never leaving a slot blank just because fewer
  // than four were uploaded), same fallback rule the Classic cover uses.
  const loaded = images.filter(Boolean)
  const slot = (i) => images[i] || (loaded.length ? loaded[i % loaded.length] : null)

  drawOceanPhoto(doc, slot(0), bigX, imgTop, bigW, imgH)
  const smallH = (imgH - 16) / 3
  for (let i = 0; i < 3; i++) {
    drawOceanPhoto(doc, slot(i + 1), smallX, imgTop + i * (smallH + 8), smallW, smallH)
  }

  let y = imgTop + imgH + 34
  doc.fillColor(OCEAN.blue).font('Times-Italic').fontSize(18).text('Explore', OM, y)
  y = doc.y + 2
  doc
    .fillColor(OCEAN.navy)
    .font('Times-Bold')
    .fontSize(50)
    .text((itinerary.destination || 'Kashmir').toUpperCase(), OM, y, { width: OCW, lineGap: 2 })
  y = doc.y + 14

  oceanRule(doc, OM, y, 70, OCEAN.cyan)
  y += 14

  const duration = computeDuration(itinerary)
  if (duration) {
    const bw = doc.widthOfString(duration, { font: 'Helvetica-Bold', fontSize: 12 }) + 32
    doc.roundedRect(OM, y, bw, 26, 13).lineWidth(1.2).strokeColor(OCEAN.blue).stroke()
    doc.fillColor(OCEAN.deep).font('Helvetica-Bold').fontSize(12).text(duration, OM, y + 7, { width: bw, align: 'center' })
  }

  const client = itinerary.customerName || leadName(itinerary.leadId)
  if (client) {
    const guestY = y + (duration ? 40 : 4)
    doc
      .fillColor(OCEAN.textSecondary)
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .text('GUEST', OM, guestY, { characterSpacing: 1 })
    doc.fillColor(OCEAN.navy).font('Helvetica-Bold').fontSize(13).text(client.toUpperCase(), OM, guestY + 13)
  }

  doc.restore()
}

function drawOceanPhoto(doc, buffer, x, y, w, h) {
  doc.save()
  try {
    doc.roundedRect(x, y, w, h, 8).clip()
    if (buffer) {
      const img = doc.openImage(buffer)
      const scale = Math.max(w / img.width, h / img.height)
      doc.image(buffer, x - (img.width * scale - w) / 2, y - (img.height * scale - h) / 2, {
        width: img.width * scale,
        height: img.height * scale,
      })
    } else {
      doc.rect(x, y, w, h).fill(OCEAN.light)
    }
  } catch {
    doc.rect(x, y, w, h).fill(OCEAN.light)
  } finally {
    doc.restore()
  }
  doc.roundedRect(x, y, w, h, 8).lineWidth(1).strokeColor(OCEAN.border).stroke()
}

/* ------------------------- Package overview -------------------------- */

function drawOceanOverview(doc, { itinerary }, y) {
  y = oceanEyebrow(doc, 'Package Overview', OM, y)
  const overview =
    itinerary.marketingOverview || 'Crafted for guests seeking premium comfort and exclusive services.'
  doc.fillColor(OCEAN.text).font('Times-Italic').fontSize(16.5).text(overview, OM, y + 6, { width: OCW * 0.9, lineGap: 5.5 })
  y = doc.y + 18
  oceanRule(doc, OM, y)
  return y + 28
}

/* --------------------------- Day-wise plan ---------------------------- */

function drawOceanDayBlock(doc, day, buffer, isLast, y) {
  const numColW = 74
  const hasPhoto = !!buffer
  const imgW = 130
  const imgH = 100
  const textX = OM + numColW
  const textW = OCW - numColW - (hasPhoto ? imgW + 16 : 0)

  const isPlainNumber = (v) => /^\d+(\.\d+)?$/.test(String(v || '').trim())
  const distanceText = day.distance ? `${day.distance}${isPlainNumber(day.distance) ? ' KM' : ''}` : ''
  const timeText = day.travelDuration ? `${day.travelDuration}${isPlainNumber(day.travelDuration) ? ' HRS' : ''}` : ''
  const metaText = [distanceText, timeText].filter(Boolean).join('     •     ')

  const blockTop = y
  doc.circle(OM + 3, y + 22, 4).fill(OCEAN.blue)

  doc.fillColor(OCEAN.textSecondary).font('Helvetica-Bold').fontSize(9.5).text('DAY', OM + 18, y - 2)
  doc
    .fillColor(OCEAN.blue)
    .font('Times-Bold')
    .fontSize(32)
    .text(String(day.dayNumber).padStart(2, '0'), OM + 16, y + 8, { width: numColW - 16, lineBreak: false })

  doc
    .fillColor(OCEAN.navy)
    .font('Helvetica-Bold')
    .fontSize(16)
    .text((day.title || `Day ${day.dayNumber}`).toUpperCase(), textX, y + 3, { width: textW })

  if (day.date) {
    doc.fillColor(OCEAN.textSecondary).font('Helvetica').fontSize(10).text(formatDate(day.date), textX, y + 3, { width: textW, align: 'right' })
  }

  let dy = doc.y + 9
  if (metaText) {
    doc.fillColor(OCEAN.blue).font('Helvetica-Bold').fontSize(10.5).text(metaText, textX, dy, { width: textW })
    dy = doc.y + 11
  }

  if (day.description) {
    doc.fillColor(OCEAN.text).fontSize(14)
    drawRichText(doc, day.description, textX, dy, { width: textW, lineGap: 4.5 })
    dy = doc.y
  }

  if (hasPhoto) {
    const imgX = OM + OCW - imgW
    drawOceanPhoto(doc, buffer, imgX, y + 3, imgW, imgH)
    dy = Math.max(dy, y + 3 + imgH)
  }

  const bottom = Math.max(blockTop + 44, dy) + 24
  if (!isLast) doc.rect(OM + 2, blockTop + 30, 1.4, bottom - blockTop - 32).fill(OCEAN.border)
  return bottom
}

function drawOceanDays(doc, days, dayBuffers, y) {
  y = oceanEyebrow(doc, '01   Itinerary', OM, y)
  y = oceanHeading(doc, 'Day-Wise Plan', OM, y + 4, 21)
  y += 24
  const list = days.length ? days : [{ dayNumber: 1, title: 'Arrival', description: '' }]
  list.forEach((day, i) => {
    y = drawOceanDayBlock(doc, day, dayBuffers?.[i], i === list.length - 1, y)
  })
  return y + 6
}

/* ---------------------------- Hotel details --------------------------- */

function drawOceanHotelSection(doc, h, buffer, itinerary, y) {
  const nightsByHotel = hotelNightsMap(itinerary)
  const amenities = h.amenities?.length ? h.amenities : DEFAULT_AMENITIES
  const nights = nightsByHotel[h.name] || nightsByHotel[h.location] || 0
  const hasPhoto = !!buffer
  const imgW = 150
  const leftW = hasPhoto ? OCW - imgW - 24 : OCW

  doc.roundedRect(OM, y, OCW, 4, 2).fill(OCEAN.light) // top-of-card hairline accent block start marker
  y += 14

  const sectionTop = y
  y = oceanEyebrow(doc, h.location || h.name || 'Destination', OM, y)
  y += 2
  doc.fillColor(OCEAN.navy).font('Times-Bold').fontSize(20).text(h.name || 'Hotel', OM, y, { width: leftW - 90 })
  if (nights > 0) {
    doc.fillColor(OCEAN.deep).font('Helvetica-Bold').fontSize(11.5).text(`${nights} NIGHT${nights > 1 ? 'S' : ''}`, OM, y + 4, { width: leftW, align: 'right' })
  }
  y = doc.y + 5
  if (h.stars > 0) {
    // Standard PDF fonts can't render the ★ glyph — draw real vector stars,
    // same as the Classic/Emerald hotel cards.
    drawStars(doc, OM, y, h.stars, { orange: OCEAN.cyan })
    y += 19
  } else {
    y += 7
  }

  const colW = leftW / 2
  const rows = Math.ceil(amenities.length / 2)
  amenities.forEach((a, idx) => {
    const col = idx % 2
    const row = Math.floor(idx / 2)
    const ax = OM + col * colW
    const ry = y + row * 20.5
    oceanDotIcon(doc, ax + 2.5, ry + 7, OCEAN.blue)
    doc.fillColor(OCEAN.text).font('Helvetica').fontSize(13).text(a, ax + 12, ry, { width: colW - 16 })
  })
  y += rows * 20.5 + 16

  if (hasPhoto) {
    const imgH = Math.max(120, y - sectionTop - 4)
    drawOceanPhoto(doc, buffer, OM + leftW + 24, sectionTop, imgW, imgH)
    y = Math.max(y, sectionTop + imgH + 16)
  }

  oceanRule(doc, OM, y)
  return y + 26
}

function drawOceanHotels(doc, hotels, hotelBuffers, itinerary, y) {
  y = oceanEyebrow(doc, '02   Accommodation', OM, y)
  y = oceanHeading(doc, 'Hotel Details', OM, y + 4, 21)
  y += 22
  hotels.forEach((h, i) => {
    y = drawOceanHotelSection(doc, h, hotelBuffers?.[i], itinerary, y)
  })
  return y
}

/* ------------------------- Pricing & stay ---------------------------- */

function drawOceanPricingTable(doc, rows, y) {
  const colHotel = OCW * 0.36
  const colRoom = OCW * 0.34
  const colRooms = OCW * 0.14
  const colNights = OCW * 0.16

  doc.fillColor(OCEAN.textSecondary).font('Helvetica-Bold').fontSize(10)
  doc.text('HOTEL', OM, y, { width: colHotel })
  doc.text('ROOM TYPE', OM + colHotel, y, { width: colRoom })
  doc.text('ROOMS', OM + colHotel + colRoom, y, { width: colRooms, align: 'center' })
  doc.text('NIGHTS', OM + colHotel + colRoom + colRooms, y, { width: colNights, align: 'right' })
  y += 17
  oceanRule(doc, OM, y, OCW, OCEAN.navy)
  y += 11

  rows.forEach((r) => {
    doc.fillColor(OCEAN.text).font('Helvetica-Bold').fontSize(13).text(r.hotelName || '—', OM, y, { width: colHotel })
    doc.fillColor(OCEAN.text).font('Helvetica').fontSize(13).text(r.roomType || '—', OM + colHotel, y, { width: colRoom })
    doc.fillColor(OCEAN.text).font('Helvetica').fontSize(13).text(String(r.roomCount || '—'), OM + colHotel + colRoom, y, { width: colRooms, align: 'center' })
    doc.fillColor(OCEAN.text).font('Helvetica').fontSize(13).text(r.nights ? `${r.nights}N` : '—', OM + colHotel + colRoom + colRooms, y, { width: colNights, align: 'right' })
    y += 25
    oceanRule(doc, OM, y - 8)
  })
  return y + 6
}

function drawOceanStatRow(doc, y, label, value) {
  doc.fillColor(OCEAN.textSecondary).font('Helvetica').fontSize(13).text(label, OM, y, { width: OCW / 2 })
  doc.fillColor(OCEAN.navy).font('Helvetica-Bold').fontSize(13.5).text(value, OM + OCW / 2, y, { width: OCW / 2, align: 'right' })
  return y + 21
}

function drawOceanPricing(doc, itinerary, y) {
  y = oceanEyebrow(doc, '03   Investment', OM, y)
  y = oceanHeading(doc, 'Pricing & Stay', OM, y + 4, 21)
  y += 24

  const travelers =
    itinerary.numberOfTravelers ||
    (Number(itinerary.numberOfAdults) || 0) + (Number(itinerary.numberOfChildren) || 0)

  y = drawOceanStatRow(doc, y, 'Total Travelers', `${travelers || 0} PAX`)
  y = drawOceanStatRow(doc, y, 'Adult Guest', String(itinerary.numberOfAdults ?? 0))
  if (itinerary.numberOfChildren > 0) y = drawOceanStatRow(doc, y, 'Children', String(itinerary.numberOfChildren))
  if (itinerary.extraBeds > 0) y = drawOceanStatRow(doc, y, 'Extra Bed', String(itinerary.extraBeds))
  if (itinerary.cnbCount > 0) y = drawOceanStatRow(doc, y, 'CNB', String(itinerary.cnbCount))
  y += 12

  const rows = roomLinesFromNightStays(itinerary)
  const vehicleLines = itinerary.vehicles?.length
    ? itinerary.vehicles
    : itinerary.vehicle
      ? [{ name: itinerary.vehicle, ...(itinerary.vehicleDetails || {}) }]
      : []

  if (rows.length) y = drawOceanPricingTable(doc, rows, y)

  vehicleLines.forEach((v) => {
    const route = [v.fromLocation, v.toLocation].filter(Boolean).join(' → ')
    doc.fillColor(OCEAN.textSecondary).font('Helvetica').fontSize(13).text(`Vehicle${route ? ` (${route})` : ''}`, OM, y, { width: OCW / 2 })
    doc.fillColor(OCEAN.navy).font('Helvetica-Bold').fontSize(13).text(v.name || '-', OM + OCW / 2, y, { width: OCW / 2, align: 'right' })
    y += 22
  })

  y += 16

  const total = Number(itinerary.totalPrice ?? itinerary.totalCost ?? 0)
  const panelH = 86
  doc.roundedRect(OM, y, OCW, panelH, 10).fill(OCEAN.deep)
  doc.roundedRect(OM, y, 6, panelH, 3).fill(OCEAN.cyan)
  doc.fillColor(OCEAN.cyan).font('Helvetica-Bold').fontSize(11).text('TOTAL PACKAGE COST', OM + 28, y + 21, { characterSpacing: 1 })
  doc
    .fillColor(OCEAN.white)
    .font('Times-Bold')
    .fontSize(29)
    .text(total > 0 ? formatInr(total) : 'Price on Request', OM + 28, y + 39, { width: OCW - 56 })
  return y + panelH + 24
}

/* ------------------------- Inclusions & policies ---------------------- */

function drawOceanInfoCard(doc, title, items, variant, y) {
  if (!items.length) return y
  y = oceanEyebrow(doc, title, OM, y)
  y += 4

  const accent = variant === 'exclude' ? OCEAN.textSecondary : variant === 'supplement' ? OCEAN.cyan : OCEAN.blue

  items.forEach((item) => {
    const fontSize = 13
    const textH = doc.heightOfString(item, { width: OCW - 32, fontSize, lineGap: 3.5 })
    const rowH = Math.max(24, textH + 8)
    if (variant === 'exclude') oceanCrossIcon(doc, OM + 1, y + 5, accent)
    else if (variant === 'supplement') oceanDotIcon(doc, OM + 5, y + 9, accent)
    else oceanCheckIcon(doc, OM, y + 5, accent)
    doc.fillColor(OCEAN.text).font('Helvetica').fontSize(fontSize).text(item, OM + 22, y, { width: OCW - 22, lineGap: 3.5 })
    y = doc.y + 10
  })
  return y + 12
}

function drawOceanInclusions(doc, itinerary, y) {
  y = oceanEyebrow(doc, '04   Policies', OM, y)
  y = oceanHeading(doc, 'Inclusions & Policies', OM, y + 4, 21)
  y += 22
  y = drawOceanInfoCard(doc, 'Inclusions', (itinerary.inclusions || []).filter(Boolean), 'include', y)

  const excludes = (itinerary.exclusions || []).filter(Boolean)
  if (excludes.length) {
    const panelTop = y
    const panelBottom = drawOceanInfoCard(
      doc,
      'Excludes',
      excludes,
      'exclude',
      y + 16
    )
    doc.save()
    doc.roundedRect(OM - 12, panelTop, OCW + 24, panelBottom - panelTop - 4, 10).fill(OCEAN.light)
    doc.restore()
    // Redraw the content on top of the panel we just painted underneath it.
    drawOceanInfoCard(doc, 'Excludes', excludes, 'exclude', y + 16)
    y = panelBottom
  }

  y = drawOceanInfoCard(doc, 'Supplement Cost', (itinerary.supplements || []).filter(Boolean), 'supplement', y)
  return y
}

/* --------------------- Terms & cancellation policy --------------------- */

function drawOceanTermsAndCancellation(doc, itinerary, y) {
  const terms = (itinerary.termsAndConditions || '').split('\n').filter(Boolean)
  const cancellation = itinerary.cancellationPolicy || []
  if (!terms.length && !cancellation.length) return y

  if (terms.length) {
    y = oceanEyebrow(doc, 'Terms & Conditions', OM, y)
    y += 6
    terms.forEach((t, i) => {
      doc.fillColor(OCEAN.blue).font('Times-Bold').fontSize(14).text(String(i + 1).padStart(2, '0'), OM, y, { width: 26, lineBreak: false })
      doc.fillColor(OCEAN.text).font('Helvetica').fontSize(13).text(t, OM + 28, y + 1, { width: OCW - 28, lineGap: 3.5 })
      y = doc.y + 11
      oceanRule(doc, OM, y - 4)
      y += 4
    })
    y += 14
  }

  if (cancellation.length) {
    y = oceanEyebrow(doc, 'Cancellation Policy', OM, y)
    y += 6
    const colW = (OCW - (cancellation.length - 1) * 12) / cancellation.length
    let maxBottom = y
    cancellation.forEach((rule, i) => {
      const isNoRefund = /no\s*refund/i.test(rule)
      const x = OM + i * (colW + 12)
      const textH = doc.heightOfString(rule, { width: colW - 24, font: 'Times-Bold', fontSize: 13.5, lineGap: 3.5 })
      const cardH = Math.max(74, textH + 48)
      doc
        .roundedRect(x, y, colW, cardH, 8)
        .lineWidth(isNoRefund ? 1.4 : 1)
        .strokeColor(isNoRefund ? OCEAN.blue : OCEAN.border)
        .stroke()
      if (isNoRefund) doc.roundedRect(x, y, colW, cardH, 8).fillOpacity(0.06).fill(OCEAN.blue)
      doc.fillOpacity(1)
      doc
        .fillColor(isNoRefund ? OCEAN.deep : OCEAN.blue)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(String(i + 1), x + 14, y + 14)
      doc
        .fillColor(isNoRefund ? OCEAN.deep : OCEAN.navy)
        .font('Times-Bold')
        .fontSize(13.5)
        .text(rule, x + 14, y + 31, { width: colW - 24, lineGap: 3.5 })
      maxBottom = Math.max(maxBottom, y + cardH)
    })
    y = maxBottom
  }

  return y
}

/* ------------------------------ Flow / footer --------------------------- */

function drawOceanFlow(doc, { itinerary, days, hotels, hotelBuffers, dayBuffers }, y) {
  y = drawOceanOverview(doc, { itinerary }, y)
  if (days.length) y = drawOceanDays(doc, days, dayBuffers, y)
  if (hotels.length) y = drawOceanHotels(doc, hotels, hotelBuffers, itinerary, y)
  y = drawOceanPricing(doc, itinerary, y)
  y = drawOceanInclusions(doc, itinerary, y)
  y = drawOceanTermsAndCancellation(doc, itinerary, y)
  return y
}

// How tall the footer band needs to be for whatever company details this
// brand actually has — a logo, contact row, and address each add their own
// space rather than being squeezed into one fixed-height bar.
function computeOceanFooterHeight(brand, hasLogo) {
  let h = 40
  if (hasLogo) h += 54
  h += 34 // brand name (bigger, Times-Bold 20)
  const contactParts = [brand?.phone, brand?.email, brand?.website].filter(Boolean)
  if (contactParts.length) h += 26
  if (brand?.address || brand?.address2) h += 22
  h += 30 // tagline
  h += 28 // bottom padding
  return Math.max(150, h)
}

function drawOceanFooter(doc, { brand, bgBuffer, logoBuffer }, top, h) {
  const w = PAGE.width
  doc.save()
  doc.translate(0, top)

  if (bgBuffer) {
    try {
      const img = doc.openImage(bgBuffer)
      const scale = Math.max(w / img.width, h / img.height)
      doc.save()
      doc.rect(0, 0, w, h).clip()
      doc.image(bgBuffer, (w - img.width * scale) / 2, (h - img.height * scale) / 2, {
        width: img.width * scale,
        height: img.height * scale,
      })
      doc.restore()
    } catch {
      doc.rect(0, 0, w, h).fill(OCEAN.deep)
    }
  } else {
    doc.rect(0, 0, w, h).fill(OCEAN.deep)
  }
  // Dark ocean veil over the photo so every line of text stays readable.
  doc.rect(0, 0, w, h).fillOpacity(0.84).fill(OCEAN.deep)
  doc.fillOpacity(1)
  doc.rect(0, 0, w, 2).fill(OCEAN.cyan)

  let y = 32
  const brandName = brand?.name || 'Travel Agency'

  if (logoBuffer) {
    try {
      const logoH = 46
      const img = doc.openImage(logoBuffer)
      const logoW = Math.min(160, (img.width / img.height) * logoH)
      doc.image(logoBuffer, w / 2 - logoW / 2, y, { fit: [logoW, logoH] })
      y += logoH + 16
    } catch {
      /* fall through to text-only brand name below */
    }
  }

  doc.fillColor(OCEAN.white).font('Times-Bold').fontSize(20).text(brandName, OM, y, { width: OCW, align: 'center' })
  y = doc.y + 12

  const contactParts = [brand?.phone, brand?.email, brand?.website].filter(Boolean)
  if (contactParts.length) {
    doc
      .fillColor('#BFE3EE')
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(contactParts.join('     |     '), OM, y, { width: OCW, align: 'center' })
    y = doc.y + 10
  }

  const addr = [brand?.address, brand?.address2].filter(Boolean).join('  ·  ')
  if (addr) {
    doc.fillColor('#9FC7D2').font('Helvetica').fontSize(10.5).text(addr, OM, y, { width: OCW, align: 'center' })
    y = doc.y + 12
  }

  doc
    .fillColor('#9FC7D2')
    .font('Helvetica')
    .fontSize(11.5)
    .text('A premium travel experience, thoughtfully prepared for you.', OM, y, { width: OCW, align: 'center' })

  doc.restore()
}

/* ------------------------------ Orchestrator --------------------------- */

async function buildOceanLuxuryPdf({
  itinerary,
  days,
  hotels,
  brand,
  brandName,
  imageBuffers,
  hotelBuffers,
  dayBuffers,
  bgBuffer,
  logoBuffer,
}) {
  const footerH = computeOceanFooterHeight(brand, !!logoBuffer)

  // Pass 1 — measure the flowing content (everything after the hero band)
  // on a throwaway tall page, exactly like the Classic/Emerald engine does.
  const measureDoc = createPdfDocument({
    size: [PAGE.width, 30000],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  })
  const contentH = drawOceanFlow(measureDoc, { itinerary, days, hotels, hotelBuffers, dayBuffers }, 0)
  const totalH = OHERO_H + contentH + footerH

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

        drawOceanHero(doc, { itinerary, brand, images: imageBuffers }, 0, OHERO_H)
        drawOceanFlow(doc, { itinerary, days, hotels, hotelBuffers, dayBuffers }, OHERO_H)
        drawOceanFooter(doc, { brand, bgBuffer, logoBuffer }, OHERO_H + contentH, footerH)

        doc.end()
      } catch (err) {
        reject(err)
      }
    })()
  })
}
