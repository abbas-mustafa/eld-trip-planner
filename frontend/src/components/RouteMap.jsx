import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { STOP_META, fmtDateTime, fmtDuration } from '../utils'

const MARKER_GLYPHS = {
  start: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
  pickup:
    '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  dropoff:
    '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  rest: '<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>',
  break:
    '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  fuel: '<line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>',
  restart:
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
}

function stopIcon(type) {
  const color = STOP_META[type]?.color || '#1e40af'
  const glyph = MARKER_GLYPHS[type] || MARKER_GLYPHS.start
  const big = type === 'start' || type === 'pickup' || type === 'dropoff'
  const size = big ? 34 : 28
  return L.divIcon({
    className: 'stop-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 2px 8px rgba(11,18,32,.35);display:flex;align-items:center;justify-content:center;">
      <svg viewBox="0 0 24 24" width="${size * 0.55}" height="${size * 0.55}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>
    </div>`,
  })
}

function FitBounds({ geometry }) {
  const map = useMap()
  useEffect(() => {
    if (geometry?.length > 1) {
      map.fitBounds(L.latLngBounds(geometry), { padding: [36, 36] })
    }
  }, [geometry, map])
  return null
}

export default function RouteMap({ route, stops }) {
  const geometry = route?.geometry || []
  const icons = useMemo(() => {
    const cache = {}
    return (type) => (cache[type] ||= stopIcon(type))
  }, [])

  return (
    <MapContainer
      center={[39, -95]}
      zoom={4}
      scrollWheelZoom
      className="z-0 h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {geometry.length > 1 && (
        <>
          <Polyline
            positions={geometry}
            pathOptions={{ color: '#0b1220', weight: 7, opacity: 0.25 }}
          />
          <Polyline
            positions={geometry}
            pathOptions={{ color: '#1e40af', weight: 4, opacity: 0.95 }}
          />
        </>
      )}
      {(stops || []).map((s, i) => (
        <Marker key={i} position={[s.lat, s.lon]} icon={icons(s.type)}>
          <Popup>
            <div style={{ minWidth: 180 }}>
              <div
                style={{
                  fontWeight: 700,
                  color: STOP_META[s.type]?.color,
                  marginBottom: 2,
                }}
              >
                {s.label}
              </div>
              <div style={{ fontSize: 12, color: '#475569' }}>
                {fmtDateTime(s.start)}
                {s.duration_hours > 0 && <> · {fmtDuration(s.duration_hours)}</>}
                <br />
                Mile {Math.round(s.miles).toLocaleString()}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
      <FitBounds geometry={geometry} />
    </MapContainer>
  )
}
