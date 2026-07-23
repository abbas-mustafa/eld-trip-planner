# RouteLog — ELD Trip Planner

**Live app:** https://eld-trip-planner-eight-beige.vercel.app
**Live API:** https://eld-trip-planner-api-gamma.vercel.app

A full-stack app that plans FMCSA-compliant truck trips. Enter your current
location, pickup, drop-off and current 70-hr cycle usage — it routes the trip,
schedules every legally required rest, break and fuel stop, and **draws the
Driver's Daily Log sheets** for each day of the trip.

**Stack:** Django + DRF (API) · React + Vite + Tailwind (UI) · Leaflet +
OpenStreetMap (map) · OSRM (routing) · Nominatim (geocoding). All map services
are free and keyless.

## Features

- 📍 **Trip inputs** — current location, pickup, drop-off (with autocomplete),
  current cycle used (hrs), trip start time
- 🗺️ **Route map** — full driving route with markers for every scheduled
  event: pickup, drop-off, 30-min breaks, 10-hr resets, 34-hr restarts, fuel
- 📋 **ELD daily logs** — pixel-faithful SVG recreation of the paper
  "Driver's Daily Log" grid, auto-drawn duty-status line, remarks, per-status
  totals and a 70-hr/8-day recap; one sheet per calendar day, downloadable
  as PNG
- ⏱️ **HOS engine** implementing the property-carrying driver rules:

| Rule | Value |
|---|---|
| Max driving per shift | 11 hr |
| On-duty window per shift | 14 hr |
| Break after cumulative driving | 30 min after 8 hr (satisfied by any 30+ min non-driving period) |
| Shift reset | 10 consecutive hrs off duty |
| Cycle | 70 hr on-duty / 8 days, 34-hr restart |
| Fueling | at least once every 1,000 mi (30 min, on duty) |
| Pickup / drop-off | 1 hr each, on duty |

## Architecture

```
backend/                      Django + DRF (stateless JSON API)
  trips/services/external.py  Nominatim geocoding + OSRM routing clients
  trips/services/hos.py       Hours-of-Service simulation engine
  trips/services/planner.py   Orchestration + daily-log builder
  trips/views.py              POST /api/plan-trip/ · GET /api/geocode/

frontend/                     React + Vite + Tailwind v4
  src/components/RouteMap.jsx   Leaflet map w/ custom stop markers
  src/components/LogSheet.jsx   SVG driver's daily log renderer
  src/components/LogsView.jsx   Day selector + duty-status strips
  src/components/TripForm.jsx   Inputs w/ debounced autocomplete
```

The HOS engine is an event simulation: it drives each route leg until the
nearest constraint binds (11-hr drive, 14-hr window, 8-hr break clock,
1,000-mi fuel interval, 70-hr cycle), inserts the required stop, and repeats.
The resulting duty timeline is split at midnights into per-day log sheets.

**Assumption:** "current cycle used" hours are treated as recently accrued, so
no hours are regained mid-trip from the rolling 8-day window; hitting the
70-hr limit triggers a 34-hr restart.

## Run locally

Backend (Python 3.12+):

```bash
cd backend
python -m venv venv
venv/Scripts/activate        # Windows  (source venv/bin/activate on Unix)
pip install -r requirements.txt
python manage.py runserver 8000
```

Frontend (Node 20+):

```bash
cd frontend
npm install
npm run dev                  # http://localhost:5173
```

The frontend reads `VITE_API_BASE` (defaults to `http://localhost:8000`).

## Deployment

Both halves deploy to **Vercel** (the API runs as a Python serverless
function — `backend/vercel.json`; being stateless, Django fits serverless
perfectly and avoids free-tier spin-down delays):

```bash
cd backend  && vercel deploy --prod   # API
cd frontend && vercel deploy --prod   # UI (set VITE_API_BASE env var first)
```

A `render.yaml` blueprint is also included if you prefer Render + gunicorn
for the API.

## API

`POST /api/plan-trip/`

```json
{
  "current_location": "Chicago, IL",
  "pickup_location": "Indianapolis, IN",
  "dropoff_location": "Dallas, TX",
  "current_cycle_used": 25,
  "start_time": "2026-07-23T08:00:00"
}
```

Returns route geometry, every scheduled stop with coordinates and timestamps,
the full duty-status timeline, per-day log sheet data and a trip summary.
