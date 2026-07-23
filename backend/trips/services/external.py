"""
External free-API clients: Nominatim (geocoding) and OSRM (routing).

Both are free, keyless public services:
  * https://nominatim.openstreetmap.org  — OpenStreetMap geocoder
  * https://router.project-osrm.org      — OSRM demo routing server
"""
from __future__ import annotations

import math

import requests

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_URL = "https://router.project-osrm.org/route/v1/driving"

HEADERS = {"User-Agent": "eld-trip-planner-assessment/1.0 (educational project)"}

METERS_PER_MILE = 1609.344


class ExternalServiceError(Exception):
    """Raised when a third-party geo service fails or returns nothing useful."""


def geocode(query: str) -> dict:
    """Resolve a free-text place name to coordinates via Nominatim."""
    query = (query or "").strip()
    if not query:
        raise ExternalServiceError("Empty location query.")

    # Allow raw "lat,lon" input (used by map-click / autocomplete selections).
    parts = query.split(",")
    if len(parts) == 2:
        try:
            lat, lon = float(parts[0]), float(parts[1])
            if -90 <= lat <= 90 and -180 <= lon <= 180:
                return {"lat": lat, "lon": lon, "name": f"{lat:.4f}, {lon:.4f}"}
        except ValueError:
            pass

    try:
        resp = requests.get(
            NOMINATIM_URL,
            params={"q": query, "format": "json", "limit": 1},
            headers=HEADERS,
            timeout=15,
        )
        resp.raise_for_status()
        results = resp.json()
    except requests.RequestException as exc:
        raise ExternalServiceError(f"Geocoding service unavailable: {exc}") from exc

    if not results:
        raise ExternalServiceError(f'Could not find a location for "{query}".')

    top = results[0]
    return {
        "lat": float(top["lat"]),
        "lon": float(top["lon"]),
        "name": top.get("display_name", query),
    }


def geocode_suggestions(query: str, limit: int = 5) -> list[dict]:
    """Return up to `limit` autocomplete suggestions for a query."""
    try:
        resp = requests.get(
            NOMINATIM_URL,
            params={"q": query, "format": "json", "limit": limit, "addressdetails": 0},
            headers=HEADERS,
            timeout=15,
        )
        resp.raise_for_status()
        return [
            {"lat": float(r["lat"]), "lon": float(r["lon"]), "name": r["display_name"]}
            for r in resp.json()
        ]
    except requests.RequestException:
        return []


def fetch_route(points: list[dict]) -> dict:
    """
    Fetch a driving route through the given points (dicts with lat/lon).

    Returns total distance (miles), duration (hours), per-leg breakdowns and
    the full route geometry as a list of [lat, lon] pairs.
    """
    coord_str = ";".join(f"{p['lon']},{p['lat']}" for p in points)
    try:
        resp = requests.get(
            f"{OSRM_URL}/{coord_str}",
            params={"overview": "full", "geometries": "geojson", "steps": "false"},
            headers=HEADERS,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as exc:
        raise ExternalServiceError(f"Routing service unavailable: {exc}") from exc

    if data.get("code") != "Ok" or not data.get("routes"):
        raise ExternalServiceError(
            "No drivable route found between the given locations."
        )

    route = data["routes"][0]
    geometry = [[lat, lon] for lon, lat in route["geometry"]["coordinates"]]

    legs = [
        {
            "distance_miles": leg["distance"] / METERS_PER_MILE,
            "duration_hours": leg["duration"] / 3600.0,
        }
        for leg in route["legs"]
    ]

    return {
        "distance_miles": route["distance"] / METERS_PER_MILE,
        "duration_hours": route["duration"] / 3600.0,
        "geometry": geometry,
        "legs": legs,
    }


def _haversine_miles(a: list[float], b: list[float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 3958.7613 * 2 * math.asin(math.sqrt(h))


def build_distance_index(geometry: list[list[float]]) -> list[float]:
    """Cumulative haversine distance (miles) at each vertex of the polyline."""
    cumulative = [0.0]
    for i in range(1, len(geometry)):
        cumulative.append(cumulative[-1] + _haversine_miles(geometry[i - 1], geometry[i]))
    return cumulative


def point_at_distance(
    geometry: list[list[float]], cumulative: list[float], target_miles: float
) -> list[float]:
    """Interpolate the [lat, lon] point that lies `target_miles` along the route."""
    if not geometry:
        return [0.0, 0.0]
    total = cumulative[-1]
    if total <= 0 or target_miles <= 0:
        return geometry[0]
    if target_miles >= total:
        return geometry[-1]

    # Binary search for the segment containing the target distance.
    lo, hi = 0, len(cumulative) - 1
    while lo < hi:
        mid = (lo + hi) // 2
        if cumulative[mid] < target_miles:
            lo = mid + 1
        else:
            hi = mid
    i = max(1, lo)
    seg_len = cumulative[i] - cumulative[i - 1]
    t = 0.0 if seg_len == 0 else (target_miles - cumulative[i - 1]) / seg_len
    lat = geometry[i - 1][0] + t * (geometry[i][0] - geometry[i - 1][0])
    lon = geometry[i - 1][1] + t * (geometry[i][1] - geometry[i - 1][1])
    return [lat, lon]
