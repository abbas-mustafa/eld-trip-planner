import { useState } from 'react'
import LogSheet from './LogSheet'
import { STATUS_META, fmtHourOfDay } from '../utils'

function DayStrip({ log }) {
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      {log.grid.map((g, i) => (
        <div
          key={i}
          style={{
            width: `${((g.end_hour - g.start_hour) / 24) * 100}%`,
            background: STATUS_META[g.status].color,
          }}
          title={`${STATUS_META[g.status].label}: ${fmtHourOfDay(g.start_hour)} – ${fmtHourOfDay(g.end_hour)}`}
        />
      ))}
    </div>
  )
}

export default function LogsView({ logs, trip }) {
  const [active, setActive] = useState(0)
  const log = logs[active]

  return (
    <div className="flex flex-col gap-4">
      {/* day selector */}
      <div className="flex flex-wrap gap-2">
        {logs.map((l, i) => (
          <button
            key={l.date}
            type="button"
            onClick={() => setActive(i)}
            className={`min-w-[132px] cursor-pointer rounded-xl border px-3.5 py-2.5 text-left transition-all ${
              i === active
                ? 'border-primary-600 bg-primary-600/5 shadow-sm ring-1 ring-primary-600/40'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
            }`}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className={`text-[12px] font-bold ${i === active ? 'text-primary-600' : 'text-navy-900'}`}>
                Day {l.day_index}
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                {new Date(`${l.date}T00:00:00`).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
            <DayStrip log={l} />
            <div className="mt-1.5 font-mono text-[10px] text-slate-500">
              {l.totals.driving.toFixed(1)}h drive · {Math.round(l.miles_today)} mi
            </div>
          </button>
        ))}
      </div>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {Object.values(STATUS_META).map((m) => (
          <span key={m.label} className="flex items-center gap-1.5 text-[12px] text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: m.color }} />
            {m.label}
          </span>
        ))}
      </div>

      <LogSheet key={log.date} log={log} trip={trip} />
    </div>
  )
}
