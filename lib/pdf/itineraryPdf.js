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
    // Continuation calls must use the 2-arg text(str, options) form — PDFKit's
    // _initOptions(x, y, options) defaults a missing x to {}, and since {} is
    // an object it gets treated AS the options (wiping the real ones, notably
    // `continued`) whenever x is passed explicitly as `undefined` instead of
    // omitted. That silently broke the wrapper chain after 2 segments, so a
    // 3rd (e.g. plain-bold-plain) restarted as a fresh paragraph instead of
    // continuing the line — exactly the stray line-break this fixes.
    if (isFirst) {
      doc.text(piece.text, x, y, { ...rest, continued: !isLast })
    } else {
      doc.text(piece.text, { ...rest, continued: !isLast })
    }
  })
}

// Splits a day description into "the part that fits beside the photo" and
// "the rest" — so once the paragraph runs past the bottom of the photo, it
// widens out to the full column instead of staying squeezed into the narrow
// side-of-photo width for its entire length. Never splits inside a **bold**
// span (tracks marker parity and extends the cut past it if needed).
function splitTextForImageWrap(doc, text, narrowWidth, availableHeight, fontSize, lineGap) {
  const str = String(text || '')
  if (availableHeight <= 0) return { narrowPart: '', restPart: str }
  const tokens = str.split(/(\s+)/) // words + the whitespace between them, alternating
  doc.font('Helvetica').fontSize(fontSize)
  let soFar = ''
  let cut = tokens.length
  for (let i = 0; i < tokens.length; i++) {
    const candidate = soFar + tokens[i]
    const plain = candidate.replace(/\*\*/g, '')
    const h = doc.heightOfString(plain, { width: narrowWidth, lineGap })
    if (h > availableHeight) {
      cut = i
      break
    }
    soFar = candidate
  }
  let combined = tokens.slice(0, cut).join('')
  while ((combined.match(/\*\*/g) || []).length % 2 === 1 && cut < tokens.length) {
    combined += tokens[cut]
    cut++
  }
  return { narrowPart: combined, restPart: tokens.slice(cut).join('') }
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
// Whoever actually built this itinerary — sales rep or owner — credited by
// name on the PDF itself, regardless of theme.
function preparedByName(itinerary) {
  return itinerary?.createdBy?.name || ''
}

function computeContactContentHeight(brand, scannerBuffer, preparedBy) {
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
  if (preparedBy) y += 30
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
  const preparedBy = preparedByName(itinerary)
  const contactH = computeContactContentHeight(brand, scannerBuffer, preparedBy)
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
        drawContact(doc, { brand, bgBuffer, logoBuffer, scannerBuffer, colors, preparedBy }, contactTop, contactH)

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
    // heightOfString ignores a fontSize passed in its options — it measures
    // with whatever's currently active on the doc, so it has to be set
    // first or this measures against the previous item/heading's size.
    doc.font('Helvetica').fontSize(fontSize)
    const textH = doc.heightOfString(item, { width: w - 32 })
    const barH = Math.max(28, textH + 14)
    doc.roundedRect(x, y, w, barH, 6).fill(bg)
    doc.circle(x + 12, y + barH / 2, 2.5).fill(accent)
    doc.fillColor(colors.black).font('Helvetica').fontSize(fontSize).text(item, x + 22, y + 8, { width: w - 34 })
    y += barH + 6
  })
  return y
}

/* ---------------------------- Contact --------------------------- */

function drawContact(doc, { brand, bgBuffer, logoBuffer, scannerBuffer, colors, preparedBy }, top, h) {
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
    // Anchored off byy (where the buttons actually landed, which can be
    // pinned near the bottom via the Math.min above) rather than the
    // pre-pin `y` — using `y` here could disagree with where the buttons
    // were really drawn, crowding "Prepared by" right up against them.
    y = byy + bh + 30
  } else {
    y += 10
  }

  if (preparedBy) {
    doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(13).text(`Prepared by ${preparedBy}`, 40, y, { width: w - 80, align: 'center' })
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

const OM = 14 // tight side margin — cards/photos/headings all read near edge-to-edge
const OCW = PAGE.width - OM * 2
const OHERO_H = 508

function oceanEyebrow(doc, text, x, y) {
  doc.rect(x, y + 3, 18, 2).fill(OCEAN.blue)
  doc
    .fillColor(OCEAN.blue)
    .font('Helvetica-Bold')
    .fontSize(11.5)
    .text(text.toUpperCase(), x + 26, y, { width: OCW - 26, characterSpacing: 1.2 })
  return y + 24
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
  // A soft top-to-bottom ocean gradient reads as a proper premium banner —
  // a single flat pale-blue fill looked cheap next to the rest of the page.
  const heroGrad = doc.linearGradient(0, 0, 0, h)
  heroGrad.stop(0, OCEAN.light).stop(0.55, '#BEE6F2').stop(1, '#8FD3ED')
  doc.rect(0, 0, w, h).fill(heroGrad)

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
    // widthOfString also ignores a font/fontSize passed in its options — it
    // measures with whatever's currently active (the 50pt destination
    // heading just drawn above), so it has to be set first or the badge
    // comes out far wider than the text it's sized around.
    doc.font('Helvetica-Bold').fontSize(14)
    const bw = doc.widthOfString(duration) + 32
    doc.roundedRect(OM, y, bw, 28, 14).lineWidth(1.2).strokeColor(OCEAN.blue).stroke()
    doc.fillColor(OCEAN.deep).text(duration, OM, y + 7, { width: bw, align: 'center' })
  }

  const client = itinerary.customerName || leadName(itinerary.leadId)
  if (client) {
    const guestY = y + (duration ? 42 : 4)
    doc
      .fillColor(OCEAN.textSecondary)
      .font('Helvetica-Bold')
      .fontSize(11.5)
      .text('GUEST', OM, guestY, { characterSpacing: 1 })
    doc.fillColor(OCEAN.navy).font('Helvetica-Bold').fontSize(13).text(client.toUpperCase(), OM, guestY + 15)
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

// Each day is its own bordered, tinted card — a "DAY 01" pill badge beside
// the title, DISTANCE/TIME as small label-over-value pairs, then the
// description (still narrow beside the photo, widening out once past it —
// the photo is never dropped). The card's height can't be known until the
// description is laid out, and PDFKit paints strictly in call order (a fill
// drawn after text would cover it) — so everything is measured first via
// heightOfString-only calls (no painting), and only once the final height is
// known does actual drawing start, using the exact same computed positions.
function drawOceanDayBlock(doc, day, buffer, isLast, y) {
  const hasPhoto = !!buffer
  const imgW = 130
  const imgH = 100
  const padX = 20
  const padY = 16
  const badgeW = 64
  const badgeH = 26
  const contentW = OCW - padX * 2
  const textX = OM + padX + badgeW + 16
  const textW = contentW - badgeW - 16 - (hasPhoto ? imgW + 16 : 0)
  const fullTextW = contentW - badgeW - 16

  const cardTop = y
  const contentTop = y + padY

  const titleText = (day.title || `Day ${day.dayNumber}`).toUpperCase()
  doc.font('Helvetica-Bold').fontSize(14)
  const titleH = doc.heightOfString(titleText, { width: textW })
  // The badge's own column also grows when a date sits under it — the title
  // row has to be at least as tall as that stack, or the date would collide
  // with the meta line to its right.
  const dateText = day.date ? formatDate(day.date) : ''
  const badgeColH = badgeH + (dateText ? 4 + 11 : 0)
  const titleRowH = Math.max(badgeColH, titleH)

  const isPlainNumber = (v) => /^\d+(\.\d+)?$/.test(String(v || '').trim())
  const distanceText = day.distance ? `${day.distance}${isPlainNumber(day.distance) ? ' km' : ''}` : ''
  const timeText = day.travelDuration ? `${day.travelDuration}${isPlainNumber(day.travelDuration) ? ' hrs' : ''}` : ''
  const hasMeta = !!(distanceText || timeText)
  const metaH = hasMeta ? 32 : 0

  const descStartY = contentTop + titleRowH + 10 + metaH
  const imageTop = contentTop
  const imageBottom = imageTop + imgH

  // ---- measure description layout (no painting yet) ----
  let narrowPart = ''
  let restPart = ''
  let descNarrowY = descStartY
  let descRestY = descStartY
  let descEndY = descStartY
  if (day.description) {
    doc.font('Helvetica').fontSize(13)
    if (hasPhoto) {
      const availableNarrowHeight = imageBottom - descStartY
      const split = splitTextForImageWrap(doc, day.description, textW, availableNarrowHeight, 13, 4)
      narrowPart = split.narrowPart
      restPart = split.restPart.replace(/^\s+/, '')
      let afterNarrowY = descStartY
      if (narrowPart.trim()) {
        afterNarrowY = descStartY + doc.heightOfString(narrowPart.replace(/\*\*/g, ''), { width: textW, lineGap: 4 })
      }
      descNarrowY = descStartY
      if (restPart.trim()) {
        descRestY = Math.max(afterNarrowY, imageBottom) + (narrowPart.trim() ? 6 : 0)
        descEndY = descRestY + doc.heightOfString(restPart.replace(/\*\*/g, ''), { width: fullTextW, lineGap: 4 })
      } else {
        descEndY = afterNarrowY
      }
    } else {
      narrowPart = day.description
      descNarrowY = descStartY
      descEndY = descStartY + doc.heightOfString(day.description.replace(/\*\*/g, ''), { width: fullTextW, lineGap: 4 })
    }
  }

  const contentBottom = Math.max(descEndY, hasPhoto ? imageBottom : 0)
  const cardH = contentBottom - cardTop + padY

  // ---- now that the height is known, draw the card, then its content ----
  doc.roundedRect(OM, cardTop, OCW, cardH, 12).fill(OCEAN.light)
  doc.roundedRect(OM, cardTop, OCW, cardH, 12).lineWidth(1).strokeColor(OCEAN.border).stroke()

  doc.roundedRect(OM + padX, contentTop, badgeW, badgeH, badgeH / 2).fill(OCEAN.blue)
  doc
    .fillColor(OCEAN.white)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(`DAY ${String(day.dayNumber).padStart(2, '0')}`, OM + padX, contentTop + 7, { width: badgeW, align: 'center' })
  if (dateText) {
    doc
      .fillColor(OCEAN.textSecondary)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(dateText, OM + padX, contentTop + badgeH + 4, { width: badgeW, align: 'center' })
  }

  doc.fillColor(OCEAN.navy).font('Helvetica-Bold').fontSize(14).text(titleText, textX, contentTop + 2, { width: textW })

  if (hasMeta) {
    // A fixed, compact column width instead of splitting the whole text
    // width in half — DISTANCE and TIME used to end up with a wide empty gap
    // between them since each got half of the (often photo-narrowed) column.
    const metaColW = 90
    const metaY = contentTop + titleRowH + 8
    doc.fillColor(OCEAN.textSecondary).font('Helvetica-Bold').fontSize(8.5)
    if (distanceText) doc.text('DISTANCE', textX, metaY, { characterSpacing: 0.6 })
    if (timeText) doc.text('TIME', textX + metaColW, metaY, { characterSpacing: 0.6 })
    doc.fillColor(OCEAN.blue).font('Helvetica-Bold').fontSize(11.5)
    if (distanceText) doc.text(distanceText, textX, metaY + 11, { width: metaColW })
    if (timeText) doc.text(timeText, textX + metaColW, metaY + 11, { width: metaColW })
  }

  if (narrowPart.trim()) {
    doc.fillColor(OCEAN.text).fontSize(13)
    drawRichText(doc, narrowPart, textX, descNarrowY, { width: textW, lineGap: 4 })
  }
  if (restPart.trim()) {
    doc.fillColor(OCEAN.text).fontSize(13)
    drawRichText(doc, restPart, textX, descRestY, { width: fullTextW, lineGap: 4 })
  }

  if (hasPhoto) {
    const imgX = OM + OCW - imgW - padX
    drawOceanPhoto(doc, buffer, imgX, imageTop, imgW, imgH)
  }

  return cardTop + cardH + 18
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

// A full-width "STAY IN <location>" banner strip (with a nights pill on the
// right) sitting on top of a bordered, tinted card — hotel name, stars,
// amenities in two columns, photo floated on the right. Same
// measure-then-paint approach as the day cards: the card's height depends
// on the amenities row count and the photo, so it's computed before any
// fill is drawn (a fill drawn after text would cover it).
function drawOceanHotelSection(doc, h, buffer, itinerary, y) {
  const nightsByHotel = hotelNightsMap(itinerary)
  const amenities = h.amenities?.length ? h.amenities : DEFAULT_AMENITIES
  const nights = nightsByHotel[h.name] || nightsByHotel[h.location] || 0
  const hasPhoto = !!buffer
  const imgW = 150
  const padX = 20
  const padY = 18
  const bannerH = 32
  const contentW = OCW - padX * 2 - (hasPhoto ? imgW + 18 : 0)

  const cardTop = y
  const bodyTop = cardTop + bannerH + padY

  doc.font('Times-Bold').fontSize(19)
  const nameH = doc.heightOfString(h.name || 'Hotel', { width: contentW - 90 })
  const starsH = h.stars > 0 ? 24 : 6
  const amenitiesLabelH = 20
  const colW = contentW / 2
  const amenityRows = Math.ceil(amenities.length / 2)
  const amenitiesRowsH = amenityRows * 19.5
  const bodyContentH = nameH + 6 + starsH + amenitiesLabelH + amenitiesRowsH

  const photoH = 130 // fixed, comfortable height — the card grows to fit it rather than squeezing it down
  let cardH = bannerH + padY * 2 + bodyContentH
  if (hasPhoto) cardH = Math.max(cardH, bannerH + padY * 2 + photoH)

  // ---- draw card + banner (bg first, content on top) ----
  doc.roundedRect(OM, cardTop, OCW, cardH, 12).fill(OCEAN.light)
  doc.roundedRect(OM, cardTop, OCW, cardH, 12).lineWidth(1).strokeColor(OCEAN.border).stroke()
  doc.save()
  doc.roundedRect(OM, cardTop, OCW, bannerH, 12).clip()
  doc.rect(OM, cardTop, OCW, bannerH).fill(OCEAN.blue)
  doc.restore()

  doc
    .fillColor(OCEAN.white)
    .font('Helvetica-Bold')
    .fontSize(11.5)
    .text((h.location || h.name || 'Destination').toUpperCase(), OM + padX, cardTop + 11, {
      width: contentW,
      characterSpacing: 0.6,
    })
  if (nights > 0) {
    const label = `${nights} NIGHT${nights > 1 ? 'S' : ''}`
    doc.font('Helvetica-Bold').fontSize(10.5)
    const bw = doc.widthOfString(label) + 20
    const bh = bannerH - 12
    doc.roundedRect(OM + OCW - bw - padX, cardTop + 6, bw, bh, bh / 2).fill(OCEAN.deep)
    doc.fillColor(OCEAN.white).text(label, OM + OCW - bw - padX, cardTop + 6 + (bh - 10.5) / 2, { width: bw, align: 'center' })
  }

  let by = bodyTop
  doc.fillColor(OCEAN.blue).font('Times-Bold').fontSize(19).text(h.name || 'Hotel', OM + padX, by, { width: contentW })
  by += nameH + 6
  if (h.stars > 0) {
    drawStars(doc, OM + padX, by, h.stars, { orange: OCEAN.cyan })
    by += starsH
  } else {
    by += starsH
  }
  doc.fillColor(OCEAN.textSecondary).font('Helvetica-Bold').fontSize(9.5).text('AMENITIES', OM + padX, by, { characterSpacing: 1 })
  by += amenitiesLabelH
  amenities.forEach((a, idx) => {
    const col = idx % 2
    const row = Math.floor(idx / 2)
    const ax = OM + padX + col * colW
    const ry = by + row * 19.5
    oceanDotIcon(doc, ax + 2.5, ry + 6, OCEAN.blue)
    doc.fillColor(OCEAN.text).font('Helvetica').fontSize(12).text(a, ax + 12, ry, { width: colW - 16 })
  })

  if (hasPhoto) {
    const imgX = OM + OCW - imgW - padX
    const imgH = cardH - bannerH - padY * 2
    drawOceanPhoto(doc, buffer, imgX, bodyTop, imgW, imgH)
  }

  return cardTop + cardH + 20
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

function oceanDiamondIcon(doc, cx, cy, color, size = 5.5) {
  doc.save()
  doc.translate(cx, cy).rotate(45)
  doc.rect(-size / 2, -size / 2, size, size).fill(color)
  doc.restore()
}

// One pill-shaped, bordered row with a diamond bullet at each end — used for
// every line in Pricing & Stay (traveler counts, each room line, vehicle,
// and the total) so they all read as one consistent list instead of a mix
// of a stat card, a table, and loose lines.
function drawOceanPillRow(doc, y, { label, sublabel, value, big, valueColor }) {
  const rowH = sublabel ? 42 : 34
  const padX = 20
  const valueW = 170
  const labelW = OCW - padX * 2 - valueW

  doc.roundedRect(OM, y, OCW, rowH, rowH / 2).lineWidth(1).strokeColor(OCEAN.border).stroke()
  oceanDiamondIcon(doc, OM, y + rowH / 2, OCEAN.blue)
  oceanDiamondIcon(doc, OM + OCW, y + rowH / 2, OCEAN.blue)

  if (sublabel) {
    doc.fillColor(OCEAN.navy).font('Helvetica-Bold').fontSize(12.5).text(label, OM + padX, y + 8, { width: labelW })
    doc.fillColor(OCEAN.textSecondary).font('Helvetica').fontSize(9.5).text(sublabel, OM + padX, y + 23, { width: labelW })
  } else {
    doc.fillColor(OCEAN.textSecondary).font('Helvetica').fontSize(12.5).text(label, OM + padX, y + (rowH - 13) / 2, { width: labelW })
  }

  const valueSize = big ? 14 : 12.5
  doc
    .fillColor(valueColor || OCEAN.blue)
    .font('Helvetica-Bold')
    .fontSize(valueSize)
    .text(value, OM + OCW - padX - valueW, y + (rowH - valueSize) / 2, { width: valueW, align: 'right' })

  return y + rowH + 10
}

function drawOceanPricing(doc, itinerary, y) {
  y = oceanEyebrow(doc, '03   Investment', OM, y)
  y = oceanHeading(doc, 'Pricing & Stay', OM, y + 4, 21)
  y += 24

  y = oceanEyebrow(doc, 'Tour Package Pricing', OM, y)
  y += 8

  const travelers =
    itinerary.numberOfTravelers ||
    (Number(itinerary.numberOfAdults) || 0) + (Number(itinerary.numberOfChildren) || 0)

  y = drawOceanPillRow(doc, y, { label: 'Total Travelers', value: `${travelers || 0} PAX` })
  y = drawOceanPillRow(doc, y, { label: 'Adult Guest', value: String(itinerary.numberOfAdults ?? 0) })
  if (itinerary.numberOfChildren > 0) y = drawOceanPillRow(doc, y, { label: 'Children', value: String(itinerary.numberOfChildren) })
  if (itinerary.extraBeds > 0) y = drawOceanPillRow(doc, y, { label: 'Extra Bed', value: String(itinerary.extraBeds) })
  if (itinerary.cnbCount > 0) y = drawOceanPillRow(doc, y, { label: 'CNB', value: String(itinerary.cnbCount) })

  const rows = roomLinesFromNightStays(itinerary)
  rows.forEach((r) => {
    y = drawOceanPillRow(doc, y, {
      label: r.hotelName || '—',
      sublabel: r.roomType ? `Room Type: ${r.roomType}` : undefined,
      value: `${r.roomCount || 1} room${(r.roomCount || 1) > 1 ? 's' : ''} · ${r.nights || 0}N`,
    })
  })

  const vehicleLines = itinerary.vehicles?.length
    ? itinerary.vehicles
    : itinerary.vehicle
      ? [{ name: itinerary.vehicle, ...(itinerary.vehicleDetails || {}) }]
      : []
  vehicleLines.forEach((v) => {
    const route = [v.fromLocation, v.toLocation].filter(Boolean).join(' - ')
    y = drawOceanPillRow(doc, y, {
      label: 'Vehicle',
      sublabel: route ? `Pickup/Drop: ${route}` : undefined,
      value: v.name || '-',
    })
  })

  y += 6
  const total = Number(itinerary.totalPrice ?? itinerary.totalCost ?? 0)
  y = drawOceanPillRow(doc, y, {
    label: 'Total Package Cost',
    value: total > 0 ? formatInr(total) : 'Price on Request',
    valueColor: OCEAN.deep,
    big: true,
  })

  return y + 8
}

/* ------------------------- Inclusions & policies ---------------------- */

// Each list (Inclusions/Excludes/Supplement Cost) gets its own bordered
// card, tinted and accented in a color that matches what it means —
// included (blue, in line with the rest of the identity), excluded (a warm
// red), supplement/extra-cost (amber) — rather than all three floating
// free on the page in the same color.
const OCEAN_INFO_STYLES = {
  include: { accent: OCEAN.blue, tint: OCEAN.light },
  exclude: { accent: '#C0504D', tint: '#FBEEEE' },
  supplement: { accent: '#B8860B', tint: '#FBF3E0' },
}

function drawOceanInfoCard(doc, title, items, variant, y) {
  if (!items.length) return y
  y = oceanEyebrow(doc, title, OM, y)
  y += 6

  const { accent, tint } = OCEAN_INFO_STYLES[variant] || OCEAN_INFO_STYLES.include
  const padX = 18
  const padY = 14
  const iconOffset = 22
  const contentW = OCW - padX * 2 - iconOffset

  // heightOfString ignores a fontSize passed in its options — it measures
  // with whatever's currently active on the doc, so it has to be set first.
  doc.font('Helvetica').fontSize(13)
  const rowHeights = items.map((item) => Math.max(24, doc.heightOfString(item, { width: contentW, lineGap: 3.5 }) + 8))
  const cardH = padY * 2 + rowHeights.reduce((a, b) => a + b, 0)

  doc.roundedRect(OM, y, OCW, cardH, 10).fill(tint)
  doc.roundedRect(OM, y, OCW, cardH, 10).lineWidth(1).strokeColor(accent).stroke()
  doc.roundedRect(OM, y, 5, cardH, 2.5).fill(accent)

  let rowY = y + padY
  items.forEach((item, i) => {
    if (variant === 'exclude') oceanCrossIcon(doc, OM + padX + 1, rowY + 5, accent)
    else if (variant === 'supplement') oceanDotIcon(doc, OM + padX + 5, rowY + 9, accent)
    else oceanCheckIcon(doc, OM + padX, rowY + 5, accent)
    doc.fillColor(OCEAN.text).font('Helvetica').fontSize(13).text(item, OM + padX + iconOffset, rowY, { width: contentW, lineGap: 3.5 })
    rowY += rowHeights[i]
  })

  return y + cardH + 16
}

function drawOceanInclusions(doc, itinerary, y) {
  y = oceanEyebrow(doc, '04   Policies', OM, y)
  y = oceanHeading(doc, 'Inclusions & Policies', OM, y + 4, 21)
  y += 22
  y = drawOceanInfoCard(doc, 'Inclusions', (itinerary.inclusions || []).filter(Boolean), 'include', y)
  y = drawOceanInfoCard(doc, 'Excludes', (itinerary.exclusions || []).filter(Boolean), 'exclude', y)
  y = drawOceanInfoCard(doc, 'Supplement Cost', (itinerary.supplements || []).filter(Boolean), 'supplement', y)
  return y
}

/* --------------------- Terms & cancellation policy --------------------- */

// Numbered rows inside a bordered, tinted card — one per line, wrapping
// naturally — used for both Terms & Conditions (ocean blue) and
// Cancellation Policy (a warm red, matching what it's actually about)
// instead of either floating loose on the page in the same color.
function drawOceanNumberedCard(doc, items, accent, tint, y, { boldRow } = {}) {
  const padX = 18
  const padY = 14
  const numColW = 28
  const contentW = OCW - padX * 2 - numColW

  doc.font('Helvetica').fontSize(13)
  const rowHeights = items.map((item) => Math.max(20, doc.heightOfString(item, { width: contentW, lineGap: 3.5 }) + 11))
  const cardH = padY * 2 + rowHeights.reduce((a, b) => a + b, 0)

  doc.roundedRect(OM, y, OCW, cardH, 10).fill(tint)
  doc.roundedRect(OM, y, OCW, cardH, 10).lineWidth(1).strokeColor(accent).stroke()
  doc.roundedRect(OM, y, 5, cardH, 2.5).fill(accent)

  let rowY = y + padY
  items.forEach((item, i) => {
    const emphasize = boldRow?.(item)
    doc
      .fillColor(emphasize ? OCEAN.deep : accent)
      .font('Times-Bold')
      .fontSize(14)
      .text(String(i + 1).padStart(2, '0'), OM + padX, rowY, { width: numColW, lineBreak: false })
    doc
      .fillColor(emphasize ? OCEAN.deep : OCEAN.text)
      .font(emphasize ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(13)
      .text(item, OM + padX + numColW, rowY + 1, { width: contentW, lineGap: 3.5 })
    rowY += rowHeights[i]
  })

  return y + cardH + 16
}

function drawOceanTermsAndCancellation(doc, itinerary, y) {
  const terms = (itinerary.termsAndConditions || '').split('\n').filter(Boolean)
  const cancellation = itinerary.cancellationPolicy || []
  if (!terms.length && !cancellation.length) return y

  if (terms.length) {
    y = oceanEyebrow(doc, 'Terms & Conditions', OM, y)
    y += 6
    y = drawOceanNumberedCard(doc, terms, OCEAN.blue, OCEAN.light, y)
  }

  if (cancellation.length) {
    y = oceanEyebrow(doc, 'Cancellation Policy', OM, y)
    y += 6
    y = drawOceanNumberedCard(doc, cancellation, '#C0504D', '#FBEEEE', y, {
      boldRow: (rule) => /no\s*refund/i.test(rule),
    })
  }

  return y
}

/* ------------------------------ Flow / footer --------------------------- */

function drawOceanFlow(doc, { itinerary, days, hotels, hotelBuffers, dayBuffers }, y) {
  y += 28 // breathing room below the hero — Package Overview started right at its bottom edge otherwise
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
function computeOceanFooterHeight(brand, hasLogo, preparedBy) {
  let h = 40
  if (hasLogo) h += 54
  h += 34 // brand name (bigger, Times-Bold 20)
  const contactParts = [brand?.phone, brand?.email, brand?.website].filter(Boolean)
  if (contactParts.length) h += 26
  if (brand?.address || brand?.address2) h += 22
  h += 30 // tagline
  if (preparedBy) h += 28
  h += 28 // bottom padding
  return Math.max(150, h)
}

function drawOceanFooter(doc, { brand, bgBuffer, logoBuffer, preparedBy }, top, h) {
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
  y = doc.y + 16

  if (preparedBy) {
    doc.fillColor(OCEAN.white).font('Helvetica-Bold').fontSize(13).text(`Prepared by ${preparedBy}`, OM, y, { width: OCW, align: 'center' })
  }

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
  const preparedBy = preparedByName(itinerary)
  const footerH = computeOceanFooterHeight(brand, !!logoBuffer, preparedBy)

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
        drawOceanFooter(doc, { brand, bgBuffer, logoBuffer, preparedBy }, OHERO_H + contentH, footerH)

        doc.end()
      } catch (err) {
        reject(err)
      }
    })()
  })
}
