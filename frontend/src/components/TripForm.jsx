import LocationInput from './LocationInput'
import {
  NavigationIcon,
  MapPinIcon,
  FlagIcon,
  GaugeIcon,
  CalendarIcon,
  LoaderIcon,
  RouteIcon,
} from './icons'

// Known coordinates are included so picking an example doesn't trigger the
// autocomplete lookup and geocodes instantly & exactly.
const CITIES = {
  chicago: { text: 'Chicago, IL', coords: '41.8781,-87.6298' },
  milwaukee: { text: 'Milwaukee, WI', coords: '43.0389,-87.9065' },
  madison: { text: 'Madison, WI', coords: '43.0722,-89.4008' },
  indianapolis: { text: 'Indianapolis, IN', coords: '39.7684,-86.1581' },
  dallas: { text: 'Dallas, TX', coords: '32.7767,-96.797' },
  newyork: { text: 'New York, NY', coords: '40.7128,-74.006' },
  philadelphia: { text: 'Philadelphia, PA', coords: '39.9526,-75.1652' },
  losangeles: { text: 'Los Angeles, CA', coords: '34.0522,-118.2437' },
}

const EXAMPLES = [
  {
    name: 'Short haul',
    current: CITIES.chicago,
    pickup: CITIES.milwaukee,
    dropoff: CITIES.madison,
    cycle: 10,
  },
  {
    name: 'Multi-day',
    current: CITIES.chicago,
    pickup: CITIES.indianapolis,
    dropoff: CITIES.dallas,
    cycle: 25,
  },
  {
    name: 'Cross-country',
    current: CITIES.newyork,
    pickup: CITIES.philadelphia,
    dropoff: CITIES.losangeles,
    cycle: 0,
  },
  {
    name: '34-hr restart',
    current: CITIES.chicago,
    pickup: CITIES.indianapolis,
    dropoff: CITIES.losangeles,
    cycle: 60,
  },
]

export default function TripForm({ form, setForm, onSubmit, loading }) {
  const setLocation = (key) => (val) =>
    setForm((f) => ({ ...f, [key]: val }))

  const cycle = Number(form.cycleUsed) || 0

  const fillExample = (ex) =>
    setForm((f) => ({
      ...f,
      current: { ...ex.current },
      pickup: { ...ex.pickup },
      dropoff: { ...ex.dropoff },
      cycleUsed: ex.cycle,
    }))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Try an example
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.name}
              type="button"
              onClick={() => fillExample(ex)}
              className="cursor-pointer rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-medium text-slate-600 transition-colors hover:border-primary-400 hover:bg-primary-600/5 hover:text-primary-600"
            >
              {ex.name}
            </button>
          ))}
        </div>
      </div>
      <LocationInput
        id="current"
        label="Current location"
        icon={<NavigationIcon size={14} className="text-primary-600" />}
        placeholder="e.g. Chicago, IL"
        value={form.current}
        onChange={setLocation('current')}
      />
      <LocationInput
        id="pickup"
        label="Pickup location"
        icon={<MapPinIcon size={14} className="text-emerald-600" />}
        placeholder="e.g. Indianapolis, IN"
        value={form.pickup}
        onChange={setLocation('pickup')}
      />
      <LocationInput
        id="dropoff"
        label="Drop-off location"
        icon={<FlagIcon size={14} className="text-red-600" />}
        placeholder="e.g. Dallas, TX"
        value={form.dropoff}
        onChange={setLocation('dropoff')}
      />

      <div>
        <label
          htmlFor="cycle"
          className="mb-1.5 flex items-center justify-between text-[13px] font-semibold text-navy-800"
        >
          <span className="flex items-center gap-1.5">
            <GaugeIcon size={14} className="text-accent-600" />
            Current cycle used
          </span>
          <span className="font-mono text-sm font-semibold text-accent-600">
            {cycle.toFixed(1)} / 70 hrs
          </span>
        </label>
        <input
          id="cycle"
          type="range"
          min="0"
          max="70"
          step="0.5"
          value={cycle}
          onChange={(e) => setForm((f) => ({ ...f, cycleUsed: e.target.value }))}
          className="w-full cursor-pointer accent-amber-600"
        />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-400">
          <span>0</span>
          <span>35</span>
          <span>70</span>
        </div>
      </div>

      <div>
        <label
          htmlFor="start"
          className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-navy-800"
        >
          <CalendarIcon size={14} className="text-primary-600" />
          Trip start
        </label>
        <input
          id="start"
          type="datetime-local"
          value={form.startTime}
          onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-navy-900 shadow-xs outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-400/30"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-primary-600/25 transition-all hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <>
            <LoaderIcon size={16} />
            Planning route &amp; logs…
          </>
        ) : (
          <>
            <RouteIcon size={16} />
            Plan Trip
          </>
        )}
      </button>
    </form>
  )
}
