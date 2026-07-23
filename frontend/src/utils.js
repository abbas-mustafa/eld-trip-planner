export const STATUS_META = {
  off_duty: { label: 'Off Duty', short: 'OFF', color: '#64748b', row: 0 },
  sleeper_berth: { label: 'Sleeper Berth', short: 'SB', color: '#6366f1', row: 1 },
  driving: { label: 'Driving', short: 'D', color: '#059669', row: 2 },
  on_duty: { label: 'On Duty (not driving)', short: 'ON', color: '#d97706', row: 3 },
}

export const STOP_META = {
  start: { label: 'Trip start', color: '#1e40af' },
  pickup: { label: 'Pickup', color: '#059669' },
  dropoff: { label: 'Drop-off', color: '#dc2626' },
  rest: { label: '10-hr rest', color: '#6366f1' },
  break: { label: '30-min break', color: '#0d9488' },
  fuel: { label: 'Fuel stop', color: '#d97706' },
  restart: { label: '34-hr restart', color: '#9333ea' },
}

export function fmtDateTime(iso) {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function fmtDate(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`)
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function fmtDuration(hours) {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function fmtHourOfDay(hour) {
  // 13.5 -> "1:30 PM"
  const h = Math.floor(hour) % 24
  const m = Math.round((hour - Math.floor(hour)) * 60)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}
