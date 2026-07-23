"""
Trip planner orchestration: geocode -> route -> HOS simulation -> API payload.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from . import external, hos


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def _hours_into_day(dt: datetime, day: datetime) -> float:
    """Hours (0-24, float) of `dt` measured from `day` 00:00."""
    return (dt - day).total_seconds() / 3600.0


def build_daily_logs(sim: hos.HOSSimulator, initial_cycle: float) -> list[dict]:
    """Split the simulated timeline into per-calendar-day ELD log sheets."""
    if not sim.segments:
        return []

    trip_start = sim.segments[0].start
    trip_end = sim.segments[-1].end
    first_day = trip_start.replace(hour=0, minute=0, second=0, microsecond=0)

    # Reconstruct running cycle usage so each sheet can show a 70-hr recap.
    logs = []
    day = first_day
    day_index = 0
    while day < trip_end:
        day_end = day + timedelta(days=1)
        grid = []
        remarks = []
        totals = {hos.OFF_DUTY: 0.0, hos.SLEEPER: 0.0,
                  hos.DRIVING: 0.0, hos.ON_DUTY: 0.0}
        miles_today = 0.0

        # Off-duty padding before the trip starts (day 1 only).
        if trip_start > day and day_index == 0:
            pad = _hours_into_day(trip_start, day)
            grid.append({"status": hos.OFF_DUTY, "start_hour": 0.0,
                         "end_hour": pad, "label": "Off duty"})
            totals[hos.OFF_DUTY] += pad

        for seg in sim.segments:
            if seg.end <= day or seg.start >= day_end:
                continue
            clip_start = max(seg.start, day)
            clip_end = min(seg.end, day_end)
            h0 = _hours_into_day(clip_start, day)
            h1 = _hours_into_day(clip_end, day)
            if h1 - h0 <= hos.EPS:
                continue
            grid.append({"status": seg.status, "start_hour": round(h0, 4),
                         "end_hour": round(h1, 4), "label": seg.label})
            totals[seg.status] += h1 - h0
            if seg.status == hos.DRIVING and seg.duration_hours > 0:
                frac = (h1 - h0) / seg.duration_hours
                miles_today += (seg.miles_end - seg.miles_start) * frac

        # Off-duty padding after the trip ends (final day only).
        if trip_end < day_end and trip_end > day:
            pad_start = _hours_into_day(trip_end, day)
            grid.append({"status": hos.OFF_DUTY, "start_hour": pad_start,
                         "end_hour": 24.0, "label": "Off duty"})
            totals[hos.OFF_DUTY] += 24.0 - pad_start

        # Remarks: every duty-status change / stop that happens today.
        for stop in sim.stops:
            if day <= stop.start < day_end:
                remarks.append({
                    "hour": round(_hours_into_day(stop.start, day), 4),
                    "label": stop.label,
                })

        logs.append({
            "date": day.strftime("%Y-%m-%d"),
            "day_index": day_index + 1,
            "grid": grid,
            "totals": {k: round(v, 2) for k, v in totals.items()},
            "miles_today": round(miles_today, 1),
            "remarks": remarks,
        })
        day = day_end
        day_index += 1

    # 70-hr/8-day recap per sheet: replay cycle usage over the timeline.
    # Build (segment, cycle_before, cycle_after) checkpoints, then sample the
    # value at each day's midnight (a restart only clears once it completes).
    cycle = initial_cycle
    checkpoints = []
    for seg in sim.segments:
        before = cycle
        if seg.status in (hos.DRIVING, hos.ON_DUTY):
            cycle += seg.duration_hours
        elif seg.duration_hours + hos.EPS >= hos.CYCLE_RESTART:
            cycle = 0.0
        checkpoints.append((seg, before, cycle))

    def cycle_at(moment: datetime) -> float:
        value = initial_cycle
        for seg, before, after in checkpoints:
            if seg.end <= moment:
                value = after
            elif seg.start < moment:
                part = (moment - seg.start).total_seconds() / 3600.0
                if seg.status in (hos.DRIVING, hos.ON_DUTY):
                    value = before + part
                else:
                    value = before  # rest in progress: no reset yet
                break
            else:
                break
        return value

    for log in logs:
        day_end = datetime.strptime(log["date"], "%Y-%m-%d") + timedelta(days=1)
        value = cycle_at(day_end)
        log["recap"] = {
            "cycle_used": round(min(value, hos.CYCLE_LIMIT), 2),
            "hours_available": round(max(0.0, hos.CYCLE_LIMIT - value), 2),
        }
    return logs


def plan_trip(current_location: str, pickup_location: str,
              dropoff_location: str, cycle_used: float,
              start_time: datetime | None = None) -> dict:
    """End-to-end trip plan. Raises external.ExternalServiceError on failure."""
    current = external.geocode(current_location)
    pickup = external.geocode(pickup_location)
    dropoff = external.geocode(dropoff_location)

    route = external.fetch_route([current, pickup, dropoff])

    if start_time is None:
        start_time = datetime.now().replace(second=0, microsecond=0)

    sim = hos.plan_schedule(start_time, cycle_used, route["legs"])

    # Pin every stop onto the route geometry by trip-odometer position.
    cumulative = external.build_distance_index(route["geometry"])
    total_route_miles = route["distance_miles"]
    scale = (cumulative[-1] / total_route_miles) if total_route_miles else 0.0
    for stop in sim.stops:
        point = external.point_at_distance(
            route["geometry"], cumulative, stop.miles * scale)
        stop.lat, stop.lon = point[0], point[1]

    # Snap key stops to their exact geocoded coordinates.
    for stop in sim.stops:
        if stop.type == "start":
            stop.lat, stop.lon = current["lat"], current["lon"]
        elif stop.type == "pickup":
            stop.lat, stop.lon = pickup["lat"], pickup["lon"]
        elif stop.type == "dropoff":
            stop.lat, stop.lon = dropoff["lat"], dropoff["lon"]

    logs = build_daily_logs(sim, cycle_used)

    trip_end = sim.segments[-1].end if sim.segments else start_time
    driving_hours = sum(s.duration_hours for s in sim.segments
                        if s.status == hos.DRIVING)

    return {
        "locations": {
            "current": current, "pickup": pickup, "dropoff": dropoff,
        },
        "route": {
            "geometry": route["geometry"],
            "distance_miles": round(route["distance_miles"], 1),
            "drive_duration_hours": round(route["duration_hours"], 2),
            "legs": [
                {"distance_miles": round(l["distance_miles"], 1),
                 "duration_hours": round(l["duration_hours"], 2)}
                for l in route["legs"]
            ],
        },
        "stops": [
            {
                "type": s.type, "label": s.label,
                "start": _iso(s.start), "end": _iso(s.end),
                "duration_hours": round(
                    (s.end - s.start).total_seconds() / 3600.0, 2),
                "miles": round(s.miles, 1),
                "lat": round(s.lat, 6), "lon": round(s.lon, 6),
            }
            for s in sim.stops
        ],
        "segments": [
            {
                "status": s.status, "label": s.label,
                "start": _iso(s.start), "end": _iso(s.end),
                "duration_hours": round(s.duration_hours, 2),
                "miles_start": round(s.miles_start, 1),
                "miles_end": round(s.miles_end, 1),
            }
            for s in sim.segments
        ],
        "logs": logs,
        "summary": {
            "start_time": _iso(start_time),
            "end_time": _iso(trip_end),
            "total_distance_miles": round(route["distance_miles"], 1),
            "total_trip_hours": round(
                (trip_end - start_time).total_seconds() / 3600.0, 2),
            "driving_hours": round(driving_hours, 2),
            "days": len(logs),
            "cycle_used_at_start": round(cycle_used, 2),
            "rest_stops": sum(1 for s in sim.stops if s.type == "rest"),
            "fuel_stops": sum(1 for s in sim.stops if s.type == "fuel"),
            "breaks": sum(1 for s in sim.stops if s.type == "break"),
            "restarts": sum(1 for s in sim.stops if s.type == "restart"),
        },
    }
