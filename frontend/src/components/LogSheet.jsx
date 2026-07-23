import { useRef } from 'react'
import { DownloadIcon } from './icons'
import { fmtDate } from '../utils'

/**
 * SVG recreation of the FMCSA "Driver's Daily Log" paper sheet, drawn and
 * filled automatically from the planned schedule.
 */

// ---- geometry constants ----------------------------------------------------
const W = 1000
const H = 760
const GX0 = 92 // grid left
const GX1 = 932 // grid right
const HOUR_W = (GX1 - GX0) / 24
const RH = 34 // row height
const GY0 = 232 // grid top
const ROWS = ['off_duty', 'sleeper_berth', 'driving', 'on_duty']
const ROW_LABELS = [
  ['1. Off Duty', ''],
  ['2. Sleeper', 'Berth'],
  ['3. Driving', ''],
  ['4. On Duty', '(not driving)'],
]
const INK = '#1d4ed8' // hand-drawn "pen" color
const PAPER_LINE = '#334155'
const FAINT = '#94a3b8'

const xAt = (hour) => GX0 + hour * HOUR_W
const rowY = (row) => GY0 + row * RH
const rowMid = (row) => rowY(row) + RH / 2

function HourScale({ y, labelAbove = true }) {
  const labels = []
  for (let h = 0; h <= 24; h++) {
    let text
    if (h === 0 || h === 24) text = 'Mid-night'
    else if (h === 12) text = 'Noon'
    else text = String(h % 12)
    labels.push(
      <text
        key={h}
        x={xAt(h)}
        y={y}
        textAnchor="middle"
        fontSize={h % 12 === 0 ? 7 : 9}
        fontWeight={600}
        fill={PAPER_LINE}
      >
        {text}
      </text>,
    )
  }
  return <g>{labels}</g>
}

function GridRows() {
  const cells = []
  for (let r = 0; r < 4; r++) {
    const yTop = rowY(r)
    const yBot = yTop + RH
    // ticks: quarter-hour short, half-hour medium, drawn hanging from the top
    for (let h = 0; h < 24; h++) {
      for (let q = 1; q < 4; q++) {
        const x = xAt(h + q / 4)
        const len = q === 2 ? RH * 0.42 : RH * 0.24
        cells.push(
          <line
            key={`t${r}-${h}-${q}`}
            x1={x}
            y1={yTop}
            x2={x}
            y2={yTop + len}
            stroke={FAINT}
            strokeWidth={0.7}
          />,
        )
      }
      cells.push(
        <line
          key={`h${r}-${h}`}
          x1={xAt(h)}
          y1={yTop}
          x2={xAt(h)}
          y2={yBot}
          stroke={PAPER_LINE}
          strokeWidth={0.9}
        />,
      )
    }
    cells.push(
      <line
        key={`row${r}`}
        x1={GX0}
        y1={yBot}
        x2={GX1}
        y2={yBot}
        stroke={PAPER_LINE}
        strokeWidth={0.9}
      />,
    )
  }
  return <g>{cells}</g>
}

function DutyLine({ grid }) {
  if (!grid?.length) return null
  const parts = []
  let prev = null
  grid.forEach((seg, i) => {
    const row = ROWS.indexOf(seg.status)
    const y = rowMid(row)
    const x0 = xAt(seg.start_hour)
    const x1 = xAt(seg.end_hour)
    if (prev !== null && prev.row !== row) {
      parts.push(
        <line
          key={`v${i}`}
          x1={x0}
          y1={rowMid(prev.row)}
          x2={x0}
          y2={y}
          stroke={INK}
          strokeWidth={2.4}
        />,
      )
    }
    parts.push(
      <line
        key={`h${i}`}
        x1={x0}
        y1={y}
        x2={x1}
        y2={y}
        stroke={INK}
        strokeWidth={2.4}
        strokeLinecap="round"
      />,
    )
    prev = { row }
  })
  return <g>{parts}</g>
}

function FieldLine({ x, y, w, label, value, valueSize = 11 }) {
  return (
    <g>
      {value && (
        <text
          x={x + w / 2}
          y={y - 4}
          textAnchor="middle"
          fontSize={valueSize}
          fontWeight={600}
          fill={INK}
        >
          {value}
        </text>
      )}
      <line x1={x} y1={y} x2={x + w} y2={y} stroke={PAPER_LINE} strokeWidth={1} />
      <text x={x + w / 2} y={y + 11} textAnchor="middle" fontSize={7.5} fill={PAPER_LINE}>
        {label}
      </text>
    </g>
  )
}

function truncate(s, n) {
  return s && s.length > n ? `${s.slice(0, n - 1)}…` : s || ''
}

export default function LogSheet({ log, trip }) {
  const svgRef = useRef(null)
  const totals = log.totals
  const totalOnDuty = (totals.driving + totals.on_duty).toFixed(1)
  const date = new Date(`${log.date}T00:00:00`)

  const downloadPng = () => {
    const svg = svgRef.current
    const xml = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = W * 2
      canvas.height = H * 2
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      const a = document.createElement('a')
      a.download = `daily-log-${log.date}.png`
      a.href = canvas.toDataURL('image/png')
      a.click()
    }
    img.src = url
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <div className="text-sm font-semibold text-navy-900">
          Day {log.day_index} — {fmtDate(log.date)}
        </div>
        <button
          type="button"
          onClick={downloadPng}
          className="flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-navy-900"
        >
          <DownloadIcon size={14} />
          PNG
        </button>
      </div>
      <div className="overflow-x-auto scroll-thin">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          xmlns="http://www.w3.org/2000/svg"
          className="min-w-[760px] bg-white"
          fontFamily="'Fira Sans', Arial, sans-serif"
          role="img"
          aria-label={`Driver's daily log for ${log.date}`}
        >
          {/* ---------------- header ---------------- */}
          <text x={40} y={44} fontSize={24} fontWeight={800} fill="#0b1220">
            Driver&apos;s Daily Log
          </text>
          <text x={40} y={60} fontSize={9} fill={PAPER_LINE}>
            (24 hours)
          </text>
          <FieldLine x={250} y={52} w={70} label="(month)" value={String(date.getMonth() + 1)} />
          <text x={330} y={48} fontSize={12} fill={PAPER_LINE}>/</text>
          <FieldLine x={342} y={52} w={70} label="(day)" value={String(date.getDate())} />
          <text x={422} y={48} fontSize={12} fill={PAPER_LINE}>/</text>
          <FieldLine x={434} y={52} w={70} label="(year)" value={String(date.getFullYear())} />
          <text x={560} y={40} fontSize={8} fill={PAPER_LINE}>
            Original — File at home terminal.
          </text>
          <text x={560} y={52} fontSize={8} fill={PAPER_LINE}>
            Duplicate — Driver retains in his/her possession for 8 days.
          </text>

          <text x={40} y={88} fontSize={10} fontWeight={700} fill={PAPER_LINE}>
            From:
          </text>
          <FieldLine x={78} y={90} w={330} label="" value={truncate(trip.from, 48)} valueSize={10} />
          <text x={432} y={88} fontSize={10} fontWeight={700} fill={PAPER_LINE}>
            To:
          </text>
          <FieldLine x={456} y={90} w={330} label="" value={truncate(trip.to, 48)} valueSize={10} />

          {/* mileage + carrier boxes */}
          <rect x={40} y={112} width={120} height={34} fill="none" stroke={PAPER_LINE} />
          <text x={100} y={133} textAnchor="middle" fontSize={13} fontWeight={700} fill={INK} fontFamily="'Fira Code', monospace">
            {Math.round(log.miles_today).toLocaleString()}
          </text>
          <text x={100} y={158} textAnchor="middle" fontSize={7.5} fill={PAPER_LINE}>
            Total Miles Driving Today
          </text>
          <rect x={172} y={112} width={120} height={34} fill="none" stroke={PAPER_LINE} />
          <text x={232} y={133} textAnchor="middle" fontSize={13} fontWeight={700} fill={INK} fontFamily="'Fira Code', monospace">
            {Math.round(log.miles_today).toLocaleString()}
          </text>
          <text x={232} y={158} textAnchor="middle" fontSize={7.5} fill={PAPER_LINE}>
            Total Mileage Today
          </text>

          <FieldLine x={420} y={124} w={420} label="Name of Carrier or Carriers" value={trip.carrier} valueSize={10} />
          <FieldLine x={420} y={158} w={420} label="Main Office Address" value={trip.office} valueSize={9} />

          <FieldLine x={40} y={196} w={340} label="Truck/Tractor and Trailer Numbers or License Plate(s)/State (show each unit)" value={trip.truck} valueSize={9} />
          <FieldLine x={420} y={196} w={420} label="Home Terminal Address" value={trip.terminal} valueSize={9} />

          {/* ---------------- graph grid ---------------- */}
          <rect x={GX0 - 62} y={GY0 - 22} width={GX1 - GX0 + 62 + 62} height={22 + 4 * RH} fill="#0b1220" opacity={0.04} rx={2} />
          <HourScale y={GY0 - 8} />
          <text x={GX1 + 34} y={GY0 - 20} textAnchor="middle" fontSize={8} fontWeight={700} fill={PAPER_LINE}>
            Total
          </text>
          <text x={GX1 + 34} y={GY0 - 11} textAnchor="middle" fontSize={8} fontWeight={700} fill={PAPER_LINE}>
            Hours
          </text>

          {/* row labels + totals */}
          {ROW_LABELS.map((lines, r) => (
            <g key={r}>
              <text x={GX0 - 58} y={rowMid(r) - (lines[1] ? 3 : -3)} fontSize={8.5} fontWeight={700} fill={PAPER_LINE}>
                {lines[0]}
              </text>
              {lines[1] && (
                <text x={GX0 - 58} y={rowMid(r) + 7} fontSize={8.5} fontWeight={700} fill={PAPER_LINE}>
                  {lines[1]}
                </text>
              )}
              <text
                x={GX1 + 31}
                y={rowMid(r) + 4}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fill={INK}
                fontFamily="'Fira Code', monospace"
              >
                {totals[ROWS[r]].toFixed(2).replace(/\.?0+$/, '') || '0'}
              </text>
              <line x1={GX1 + 4} y1={rowY(r)} x2={GX1 + 58} y2={rowY(r)} stroke={PAPER_LINE} strokeWidth={0.7} />
            </g>
          ))}
          <line x1={GX1 + 4} y1={rowY(4)} x2={GX1 + 58} y2={rowY(4)} stroke={PAPER_LINE} strokeWidth={0.7} />
          <text x={GX1 + 31} y={rowY(4) + 16} textAnchor="middle" fontSize={11} fontWeight={700} fill={PAPER_LINE} fontFamily="'Fira Code', monospace">
            = 24
          </text>

          {/* outer frame */}
          <rect x={GX0} y={GY0} width={GX1 - GX0} height={4 * RH} fill="none" stroke="#0b1220" strokeWidth={1.6} />
          <GridRows />
          <DutyLine grid={log.grid} />

          {/* ---------------- remarks ---------------- */}
          {(() => {
            const RY = GY0 + 4 * RH + 26
            return (
              <g>
                <text x={40} y={RY} fontSize={11} fontWeight={800} fill="#0b1220">
                  Remarks
                </text>
                <line x1={GX0} y1={RY + 78} x2={GX1} y2={RY + 78} stroke={PAPER_LINE} strokeWidth={1} />
                {log.remarks.map((r, i) => {
                  const x = xAt(Math.min(r.hour, 23.98))
                  const flip = r.hour > 18 // avoid clipping at the right edge
                  return (
                    <g key={i}>
                      <line x1={x} y1={RY - 10} x2={x} y2={RY + 2} stroke={INK} strokeWidth={1.2} />
                      <text
                        x={x}
                        y={RY + 8}
                        fontSize={8}
                        fill={INK}
                        textAnchor={flip ? 'end' : 'start'}
                        transform={`rotate(${flip ? -38 : 38} ${x} ${RY + 8})`}
                      >
                        {truncate(r.label, 34)}
                      </text>
                    </g>
                  )
                })}
                <text x={GX0} y={RY + 92} fontSize={7.5} fill={PAPER_LINE}>
                  Enter name of place you reported and where released from work and when and where each change of duty occurred. Use time standard of home terminal.
                </text>
              </g>
            )
          })()}

          {/* ---------------- shipping docs ---------------- */}
          {(() => {
            const SY = GY0 + 4 * RH + 140
            return (
              <g>
                <text x={40} y={SY} fontSize={10} fontWeight={800} fill="#0b1220">
                  Shipping
                </text>
                <text x={40} y={SY + 12} fontSize={10} fontWeight={800} fill="#0b1220">
                  Documents:
                </text>
                <FieldLine x={130} y={SY + 4} w={250} label="DVL or Manifest No." value={trip.manifest} valueSize={9} />
                <FieldLine x={130} y={SY + 34} w={250} label="Shipper &amp; Commodity" value={trip.shipper} valueSize={9} />
              </g>
            )
          })()}

          {/* ---------------- recap ---------------- */}
          {(() => {
            const CY = H - 118
            const box = (x, w, title, value, sub) => (
              <g>
                <rect x={x} y={CY} width={w} height={64} rx={4} fill="#f8fafc" stroke="#cbd5e1" />
                <text x={x + w / 2} y={CY + 16} textAnchor="middle" fontSize={8} fontWeight={700} fill={PAPER_LINE}>
                  {title}
                </text>
                <text x={x + w / 2} y={CY + 40} textAnchor="middle" fontSize={16} fontWeight={700} fill={INK} fontFamily="'Fira Code', monospace">
                  {value}
                </text>
                <text x={x + w / 2} y={CY + 56} textAnchor="middle" fontSize={7} fill={FAINT}>
                  {sub}
                </text>
              </g>
            )
            return (
              <g>
                <text x={40} y={CY - 10} fontSize={10} fontWeight={800} fill="#0b1220">
                  Recap — 70 Hour / 8 Day
                </text>
                {box(40, 210, 'On duty hours today (lines 3 + 4)', totalOnDuty, 'driving + on duty not driving')}
                {box(266, 210, 'A. Total on-duty hours, 8-day period', log.recap.cycle_used.toFixed(1), 'including today')}
                {box(492, 210, 'B. Hours available tomorrow', log.recap.hours_available.toFixed(1), '70 hr minus A')}
                {box(718, 222, 'C. 34-hr restart', log.recap.cycle_used === 0 ? 'RESET' : '—', 'if 34 consecutive hours off duty taken')}
              </g>
            )
          })()}
        </svg>
      </div>
    </div>
  )
}
