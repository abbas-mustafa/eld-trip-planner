import { useState } from 'react'
import { planTrip } from './api'
import TripForm from './components/TripForm'
import SummaryCards from './components/SummaryCards'
import RouteMap from './components/RouteMap'
import Itinerary from './components/Itinerary'
import LogsView from './components/LogsView'
import {
  TruckIcon,
  RouteIcon,
  FileTextIcon,
  ClockIcon,
  AlertIcon,
  MapPinIcon,
} from './components/icons'

const defaultStart = () => {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const RULES = [
  ['11 hr', 'max driving per shift'],
  ['14 hr', 'on-duty window'],
  ['30 min', 'break after 8 hrs driving'],
  ['70 hr', 'per 8-day cycle'],
  ['10 hr', 'off-duty daily reset'],
  ['1,000 mi', 'between fuel stops'],
]

export default function App() {
  const [form, setForm] = useState({
    current: { text: '', coords: null },
    pickup: { text: '', coords: null },
    dropoff: { text: '', coords: null },
    cycleUsed: 0,
    startTime: defaultStart(),
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [tab, setTab] = useState('route')

  const submit = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await planTrip({
        current_location: form.current.coords || form.current.text,
        pickup_location: form.pickup.coords || form.pickup.text,
        dropoff_location: form.dropoff.coords || form.dropoff.text,
        current_cycle_used: Number(form.cycleUsed) || 0,
        start_time: form.startTime,
      })
      setResult(data)
      setTab('route')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const tripMeta = result && {
    from: result.locations.current.name,
    to: result.locations.dropoff.name,
    carrier: 'Property Carrier — 70 hr / 8 day',
    office: 'Main Office',
    terminal: 'Home Terminal',
    truck: 'Truck #101',
    manifest: `TRIP-${result.summary.start_time.slice(0, 10).replaceAll('-', '')}`,
    shipper: 'General Freight',
  }

  return (
    <div className="min-h-screen">
      {/* ---------- header ---------- */}
      <header className="border-b border-navy-800 bg-navy-950 text-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-600/15 ring-1 ring-accent-600/40">
              <TruckIcon size={22} className="text-accent-500" />
            </div>
            <div>
              <div className="text-lg font-bold leading-tight tracking-tight">
                RouteLog
              </div>
              <div className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
                HOS Trip Planner &amp; ELD Logs
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-[12px] text-slate-400 md:flex">
            <ClockIcon size={14} className="text-accent-500" />
            FMCSA §395 — Property-carrying · 70 hr / 8 days
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] grid-cols-1 gap-5 px-5 py-6 lg:grid-cols-[360px_1fr]">
        {/* ---------- left: form ---------- */}
        <aside className="flex flex-col gap-4 self-start lg:sticky lg:top-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-1 text-base font-bold text-navy-900">
              Plan a trip
            </h2>
            <p className="mb-4 text-[13px] leading-relaxed text-slate-500">
              Enter trip details — we&apos;ll route it, schedule every rest,
              break and fuel stop, and draw your daily logs.
            </p>
            <TripForm form={form} setForm={setForm} onSubmit={submit} loading={loading} />
            {error && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] leading-snug text-red-700"
              >
                <AlertIcon size={16} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-slate-500">
              HOS rules applied
            </h3>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-2.5">
              {RULES.map(([v, d]) => (
                <li key={d} className="text-[12px] leading-tight text-slate-600">
                  <span className="font-mono text-[13px] font-semibold text-navy-900">
                    {v}
                  </span>
                  <br />
                  {d}
                </li>
              ))}
            </ul>
          </section>
        </aside>

        {/* ---------- right: results ---------- */}
        <section className="min-w-0">
          {!result && !loading && (
            <div className="flex h-full min-h-[480px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600/8 ring-1 ring-primary-600/15">
                <RouteIcon size={30} className="text-primary-600" />
              </div>
              <h2 className="mb-1.5 text-lg font-bold text-navy-900">
                Your trip plan will appear here
              </h2>
              <p className="max-w-sm text-sm leading-relaxed text-slate-500">
                Route map with every scheduled stop, a full itinerary, and
                FMCSA-style daily log sheets — generated automatically.
              </p>
            </div>
          )}

          {loading && (
            <div className="flex h-full min-h-[480px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <div className="relative mb-5 h-14 w-14">
                <div className="absolute inset-0 animate-ping rounded-full bg-primary-600/20" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary-600/10">
                  <TruckIcon size={26} className="text-primary-600" />
                </div>
              </div>
              <div className="text-sm font-semibold text-navy-900">
                Planning your trip…
              </div>
              <div className="mt-1 text-[12px] text-slate-500">
                geocoding · routing · HOS scheduling · drawing logs
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="flex flex-col gap-4">
              <SummaryCards summary={result.summary} />

              {/* tabs */}
              <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                {[
                  ['route', 'Route & Stops', RouteIcon],
                  ['logs', `Daily Logs (${result.logs.length})`, FileTextIcon],
                ].map(([key, label, TabIcon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                      tab === key
                        ? 'bg-navy-950 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-navy-900'
                    }`}
                  >
                    <TabIcon size={16} />
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'route' && (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_330px]">
                  <div className="h-[440px] overflow-hidden rounded-xl border border-slate-200 shadow-sm xl:h-[560px]">
                    <RouteMap route={result.route} stops={result.stops} />
                  </div>
                  <div className="max-h-[560px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-sm scroll-thin">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-navy-900">
                      <MapPinIcon size={16} className="text-primary-600" />
                      Itinerary — {result.stops.length} events
                    </h3>
                    <Itinerary stops={result.stops} />
                  </div>
                </div>
              )}

              {tab === 'logs' && <LogsView logs={result.logs} trip={tripMeta} />}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-slate-200 py-5 text-center text-[12px] text-slate-400">
        Built with Django + React · Routing by OSRM · Geocoding &amp; map data ©
        OpenStreetMap contributors
      </footer>
    </div>
  )
}
