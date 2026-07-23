from datetime import datetime

from rest_framework.decorators import api_view
from rest_framework.response import Response

from .services import external, planner


@api_view(["POST"])
def plan_trip(request):
    data = request.data or {}
    current = data.get("current_location", "")
    pickup = data.get("pickup_location", "")
    dropoff = data.get("dropoff_location", "")

    errors = {}
    if not str(current).strip():
        errors["current_location"] = "Current location is required."
    if not str(pickup).strip():
        errors["pickup_location"] = "Pickup location is required."
    if not str(dropoff).strip():
        errors["dropoff_location"] = "Drop-off location is required."

    try:
        cycle_used = float(data.get("current_cycle_used", 0) or 0)
        if not 0 <= cycle_used <= 70:
            errors["current_cycle_used"] = "Must be between 0 and 70 hours."
    except (TypeError, ValueError):
        cycle_used = 0.0
        errors["current_cycle_used"] = "Must be a number between 0 and 70."

    start_time = None
    raw_start = data.get("start_time")
    if raw_start:
        try:
            start_time = datetime.fromisoformat(str(raw_start)).replace(
                tzinfo=None)
        except ValueError:
            errors["start_time"] = "Invalid ISO datetime."

    if errors:
        return Response({"errors": errors}, status=400)

    try:
        result = planner.plan_trip(current, pickup, dropoff, cycle_used,
                                   start_time)
    except external.ExternalServiceError as exc:
        return Response({"errors": {"detail": str(exc)}}, status=422)

    return Response(result)


@api_view(["GET"])
def geocode_search(request):
    query = request.GET.get("q", "").strip()
    if len(query) < 3:
        return Response({"results": []})
    return Response({"results": external.geocode_suggestions(query)})
