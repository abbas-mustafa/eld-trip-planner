import { RouteIcon, ClockIcon, CalendarIcon, GaugeIcon } from './icons'
import { fmtDuration } from '../utils'

function Card({ icon, label, value, sub, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </div>
        <div className="truncate font-mono text-lg font-semibold leading-tight text-navy-900">
          {value}
        </div>
        {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
      </div>
    </div>
  )
}

export default function SummaryCards({ summary }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Card
        icon={<RouteIcon size={20} className="text-primary-600" />}
        tone="bg-primary-600/10"
        label="Total distance"
        value={`${summary.total_distance_miles.toLocaleString()} mi`}
        sub={`${summary.fuel_stops} fuel stop${summary.fuel_stops === 1 ? '' : 's'}`}
      />
      <Card
        icon={<ClockIcon size={20} className="text-emerald-600" />}
        tone="bg-emerald-600/10"
        label="Driving time"
        value={fmtDuration(summary.driving_hours)}
        sub={`${fmtDuration(summary.total_trip_hours)} door-to-door`}
      />
      <Card
        icon={<CalendarIcon size={20} className="text-indigo-600" />}
        tone="bg-indigo-600/10"
        label="Log days"
        value={summary.days}
        sub={`${summary.rest_stops} overnight rest${summary.rest_stops === 1 ? '' : 's'}${summary.restarts ? ` · ${summary.restarts} restart` : ''}`}
      />
      <Card
        icon={<GaugeIcon size={20} className="text-accent-600" />}
        tone="bg-accent-600/10"
        label="Cycle at start"
        value={`${summary.cycle_used_at_start} h`}
        sub="70-hr / 8-day rule"
      />
    </div>
  )
}
