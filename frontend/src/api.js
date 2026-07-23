// strip stray whitespace/BOM (can sneak in via CLI-set env vars) + trailing /
const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/^[\s﻿]+|[\s﻿]+$/g, '')
    .replace(/\/$/, '') || 'http://localhost:8000'

export async function planTrip(payload) {
  const resp = await fetch(`${API_BASE}/api/plan-trip/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    const errors = data.errors || {}
    const message =
      errors.detail ||
      Object.values(errors)[0] ||
      'Something went wrong planning the trip.'
    throw new Error(message)
  }
  return data
}

export async function searchPlaces(query) {
  const resp = await fetch(
    `${API_BASE}/api/geocode/?q=${encodeURIComponent(query)}`,
  )
  if (!resp.ok) return []
  const data = await resp.json().catch(() => ({ results: [] }))
  return data.results || []
}
