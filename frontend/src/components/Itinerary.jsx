import { STOP_META, fmtDateTime, fmtDuration } from '../utils'
import {
  NavigationIcon,
  MapPinIcon,
  FlagIcon,
  BedIcon,
  CoffeeIcon,
  FuelIcon,
  RefreshIcon,
} from './icons'

const STOP_ICONS = {
  start: NavigationIcon,
  pickup: MapPinIcon,
  dropoff: FlagIcon,
  rest: BedIcon,
  break: CoffeeIcon,
  fuel: FuelIcon,
  restart: RefreshIcon,
}

export default function Itinerary({ stops }) {
  return (
    <ol className="relative ml-4 border-l-2 border-slate-200">
      {stops.map((s, i) => {
        const meta = STOP_META[s.type] || STOP_META.start
        const StopIcon = STOP_ICONS[s.type] || NavigationIcon
        return (
          <li key={i} className="relative pb-5 pl-8 last:pb-0">
            <span
              className="absolute -left-[15px] top-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow-sm"
              style={{ background: meta.color }}
            >
              <StopIcon size={13} className="text-white" />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-semibold text-navy-900">
                {s.label}
              </span>
              {s.duration_hours > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600">
                  {fmtDuration(s.duration_hours)}
                </span>
              )}
            </div>
            <div className="mt-0.5 font-mono text-[12px] text-slate-500">
              {fmtDateTime(s.start)} · mile {Math.round(s.miles).toLocaleString()}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
