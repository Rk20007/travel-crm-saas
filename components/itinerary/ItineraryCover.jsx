'use client'

/**
 * ItineraryCover — faithful A4 recreation of the brochure cover template.
 *
 * Fixed A4 canvas (794 x 1123 @ 96dpi) so it exports cleanly to PDF. Wrap it in
 * a scaling container if you need it to shrink on small screens, e.g.:
 *   <div className="origin-top-left scale-[0.5] md:scale-100"> <ItineraryCover .../> </div>
 */
export default function ItineraryCover({
  logo,
  title = 'KASHMIR',
  duration = { nights: '9N/10D', tier: 'Premium Luxury' },
  clientName = 'MR SUOOD SYED',
  overview = 'Crafted for guests seeking premium comfort and exclusive services. Includes 4★ / 5★ hotels, luxury houseboats, private vehicles, personalized itineraries, premium dining experiences, and priority services for a truly royal Kashmir experience.',
  company = {
    phone: '+91-6005242675',
    website: 'www.twinbholidays.com',
    name: 'TWIN BROTHERS HOLIDAYS',
  },
  images = { top: '', second: '', third: '', fourth: '' },
}) {
  // Diamond cards: center (cx, cy) + size on the 794x1123 canvas, rotated 45deg.
  // Exactly FOUR cards, cascading and overlapping down the right side.
  const cards = [
    { key: 'top', src: images.top, cx: 604, cy: 120, size: 198 },
    { key: 'second', src: images.second, cx: 484, cy: 296, size: 180 },
    { key: 'third', src: images.third, cx: 610, cy: 468, size: 192 },
    { key: 'fourth', src: images.fourth, cx: 486, cy: 640, size: 180 },
  ]

  return (
    <div
      className="relative overflow-hidden bg-gradient-to-b from-[#e21b22] via-[#c31219] to-[#5e0c11] text-white"
      style={{ width: 794, height: 1123 }}
    >
      {/* ---------- RIGHT DIAMOND COLLAGE ---------- */}
      {cards.map((c) => (
        <div
          key={c.key}
          className="absolute overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10"
          style={{
            width: c.size,
            height: c.size,
            left: c.cx - c.size / 2,
            top: c.cy - c.size / 2,
            transform: 'rotate(45deg)',
          }}
        >
          {c.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.src} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-[#7a0f14]" />
          )}
        </div>
      ))}

      {/* ---------- TOP LEFT: LOGO ---------- */}
      <div className="absolute left-[48px] top-[46px]">
        <div className="flex h-[70px] w-[190px] items-center justify-center rounded-md bg-white px-3 shadow-lg">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Logo" className="max-h-[54px] max-w-[166px] object-contain" />
          ) : (
            <span className="text-center text-[13px] font-bold leading-tight text-[#7a0f14]">
              {company.name}
            </span>
          )}
        </div>
        <p className="mt-2 text-[11px] font-medium tracking-wide text-white/90">Official Itinerary</p>
      </div>

      {/* ---------- LEFT TITLE ---------- */}
      <div className="absolute left-[48px] top-[168px]">
        <p className="font-serif text-[30px] italic leading-none text-amber-400">Explore</p>
        <h1 className="mt-1 text-[62px] font-extrabold uppercase leading-none tracking-tight text-white">
          {title}
        </h1>
      </div>

      {/* ---------- DURATION BADGE ---------- */}
      <div className="absolute left-0 top-[430px]">
        {/* maroon border (outer) */}
        <div
          className="bg-[#6e0c11] p-[3px]"
          style={{ clipPath: 'polygon(0 0, 82% 0, 100% 50%, 82% 100%, 0 100%)' }}
        >
          {/* golden outline */}
          <div
            className="bg-[#e0a12a] p-[2px]"
            style={{ clipPath: 'polygon(0 0, 82% 0, 100% 50%, 82% 100%, 0 100%)' }}
          >
            {/* yellow face */}
            <div
              className="h-[62px] w-[210px] bg-gradient-to-r from-[#f5a623] to-[#f2870f] pl-[26px] pr-[40px] pt-[9px]"
              style={{ clipPath: 'polygon(0 0, 82% 0, 100% 50%, 82% 100%, 0 100%)' }}
            >
              <div className="text-[22px] font-extrabold leading-none text-white">
                {duration.nights}
              </div>
              <div className="mt-1 text-[11px] font-medium leading-none text-white/95">
                {duration.tier}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- CLIENT NAME ---------- */}
      <div className="absolute left-[48px] top-[915px]">
        <span className="text-[15px] font-bold tracking-wide text-white">CLIENT NAME :- </span>
        <span className="text-[15px] font-bold tracking-wide text-amber-400">{clientName}</span>
      </div>

      {/* ---------- PACKAGE OVERVIEW ---------- */}
      <div className="absolute inset-x-0 bottom-[42px] bg-white px-[40px] py-[16px]">
        <h2 className="text-[17px] font-bold text-[#141414]">Package Overview</h2>
        <p className="mt-2 text-justify text-[11px] leading-[1.5] text-[#4b5563]">{overview}</p>
      </div>

      {/* ---------- FOOTER ---------- */}
      <div className="absolute inset-x-0 bottom-0 flex h-[42px] items-center justify-center gap-10 bg-[#5e0c11] px-6 text-[11px] font-semibold tracking-wide text-white">
        <span>{company.phone}</span>
        <span>{company.website}</span>
        <span>{company.name}</span>
      </div>
    </div>
  )
}
