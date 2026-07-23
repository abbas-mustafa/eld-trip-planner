"""
FMCSA Hours-of-Service scheduling engine.

Simulates a property-carrying driver under the 70-hour / 8-day rule:

  * 11-hour driving limit per shift            (§395.3(a)(3)(i))
  * 14-hour on-duty window per shift           (§395.3(a)(2))
  * 30-minute break after 8h cumulative driving (§395.3(a)(3)(ii))
    — satisfied by any 30+ min non-driving period, incl. on-duty stops
  * 10 consecutive hours off duty resets the shift
  * 70-hour on-duty limit in 8 days; a 34-hour restart resets the cycle
  * Fuel stop (30 min, on duty) at least every 1,000 miles
  * 1 hour on duty for pickup, 1 hour for drop-off
  * No adverse driving conditions

Assumption: the "current cycle used" hours were accrued recently, so no
hours are regained from the rolling 8-day window during the trip; when the
70-hour limit is reached the driver takes a 34-hour restart.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta

EPS = 1e-6

MAX_DRIVE_PER_SHIFT = 11.0     # hours
DUTY_WINDOW = 14.0             # hours
BREAK_TRIGGER_DRIVE = 8.0      # hours of driving before a 30-min break
BREAK_DURATION = 0.5           # hours
SHIFT_RESET = 10.0             # consecutive off-duty hours to reset a shift
CYCLE_LIMIT = 70.0             # on-duty hours per 8 days
CYCLE_RESTART = 34.0           # hours off duty to restart the cycle
FUEL_INTERVAL_MILES = 1000.0
FUEL_DURATION = 0.5            # hours, on duty
PICKUP_DURATION = 1.0          # hours, on duty
DROPOFF_DURATION = 1.0         # hours, on duty

# Duty statuses (match the four lines of a paper log)
OFF_DUTY = "off_duty"
SLEEPER = "sleeper_berth"
DRIVING = "driving"
ON_DUTY = "on_duty"


@dataclass
class Segment:
    """One contiguous duty-status block on the timeline."""
    status: str
    start: datetime
    end: datetime
    label: str
    miles_start: float
    miles_end: float

    @property
    def duration_hours(self) -> float:
        return (self.end - self.start).total_seconds() / 3600.0


@dataclass
class StopEvent:
    """A non-driving event to pin on the map / itinerary."""
    type: str            # start | pickup | dropoff | rest | break | fuel | restart
    label: str
    start: datetime
    end: datetime
    miles: float         # trip-odometer position of the event
    lat: float = 0.0
    lon: float = 0.0


@dataclass
class HOSSimulator:
    start_time: datetime
    initial_cycle_used: float

    now: datetime = field(init=False)
    segments: list[Segment] = field(default_factory=list)
    stops: list[StopEvent] = field(default_factory=list)

    cycle_used: float = field(init=False)
    shift_start: datetime | None = None
    drive_in_shift: float = 0.0
    drive_since_break: float = 0.0
    miles: float = 0.0
    miles_since_fuel: float = 0.0

    def __post_init__(self):
        self.now = self.start_time
        self.cycle_used = max(0.0, min(CYCLE_LIMIT, self.initial_cycle_used))

    # ---- helpers -------------------------------------------------------

    def _window_elapsed(self) -> float:
        if self.shift_start is None:
            return 0.0
        return (self.now - self.shift_start).total_seconds() / 3600.0

    def _add_segment(self, status: str, hours: float, label: str,
                     miles_delta: float = 0.0):
        end = self.now + timedelta(hours=hours)
        self.segments.append(Segment(
            status=status, start=self.now, end=end, label=label,
            miles_start=self.miles, miles_end=self.miles + miles_delta,
        ))
        self.miles += miles_delta
        self.now = end

    def _add_stop(self, type_: str, label: str, hours: float):
        self.stops.append(StopEvent(
            type=type_, label=label,
            start=self.now, end=self.now + timedelta(hours=hours),
            miles=self.miles,
        ))

    # ---- duty-status actions ------------------------------------------

    def rest(self, hours: float, label: str, status: str = SLEEPER,
             stop_type: str = "rest"):
        """Off-duty / sleeper period. 10h+ resets the shift; 34h+ the cycle."""
        self._add_stop(stop_type, label, hours)
        self._add_segment(status, hours, label)
        if hours + EPS >= BREAK_DURATION:
            self.drive_since_break = 0.0
        if hours + EPS >= SHIFT_RESET:
            self.shift_start = None
            self.drive_in_shift = 0.0
        if hours + EPS >= CYCLE_RESTART:
            self.cycle_used = 0.0

    def take_break(self):
        self.rest(BREAK_DURATION, "30-min rest break", status=OFF_DUTY,
                  stop_type="break")

    def daily_reset(self):
        self.rest(SHIFT_RESET, "10-hr reset (sleeper berth)", status=SLEEPER,
                  stop_type="rest")

    def cycle_restart(self):
        self.rest(CYCLE_RESTART, "34-hr cycle restart", status=OFF_DUTY,
                  stop_type="restart")

    def on_duty_task(self, hours: float, label: str, stop_type: str):
        """On-duty (not driving) work: pickup, drop-off, fueling."""
        # The 70-hr rule must have room for this on-duty time.
        if self.cycle_used + hours > CYCLE_LIMIT + EPS:
            self.cycle_restart()
        if self.shift_start is None:
            self.shift_start = self.now
        self._add_stop(stop_type, label, hours)
        self._add_segment(ON_DUTY, hours, label)
        self.cycle_used += hours
        if hours + EPS >= BREAK_DURATION:
            # A 30+ min non-driving period satisfies the break requirement.
            self.drive_since_break = 0.0
        if stop_type == "fuel":
            self.miles_since_fuel = 0.0

    # ---- driving -------------------------------------------------------

    def drive_leg(self, distance_miles: float, duration_hours: float,
                  leg_label: str):
        """Drive an entire route leg, inserting breaks/rests/fuel as needed."""
        if duration_hours <= EPS or distance_miles <= EPS:
            return
        speed = distance_miles / duration_hours  # avg mph for this leg
        remaining = duration_hours

        while remaining > EPS:
            # 1. Out of 70-hr cycle hours → 34-hr restart.
            if CYCLE_LIMIT - self.cycle_used <= EPS:
                self.cycle_restart()
                continue

            # 2. Out of shift driving hours or duty window → 10-hr reset.
            if (MAX_DRIVE_PER_SHIFT - self.drive_in_shift <= EPS
                    or DUTY_WINDOW - self._window_elapsed() <= EPS):
                self.daily_reset()
                continue

            # 3. 8 hours of driving since last 30-min break → break now.
            if BREAK_TRIGGER_DRIVE - self.drive_since_break <= EPS:
                # If the window can't fit a break plus meaningful driving,
                # take the full reset instead.
                if DUTY_WINDOW - self._window_elapsed() < BREAK_DURATION + 0.25:
                    self.daily_reset()
                else:
                    self.take_break()
                continue

            # 4. Fuel every 1,000 miles.
            if FUEL_INTERVAL_MILES - self.miles_since_fuel <= EPS:
                if DUTY_WINDOW - self._window_elapsed() < FUEL_DURATION + 0.25:
                    self.daily_reset()
                else:
                    self.on_duty_task(
                        FUEL_DURATION,
                        f"Fuel stop (mile {self.miles:,.0f})",
                        stop_type="fuel",
                    )
                continue

            # 5. Drive until the nearest constraint bites.
            if self.shift_start is None:
                self.shift_start = self.now
            available = min(
                remaining,
                MAX_DRIVE_PER_SHIFT - self.drive_in_shift,
                DUTY_WINDOW - self._window_elapsed(),
                BREAK_TRIGGER_DRIVE - self.drive_since_break,
                CYCLE_LIMIT - self.cycle_used,
                (FUEL_INTERVAL_MILES - self.miles_since_fuel) / speed,
            )
            available = max(available, EPS)
            miles_delta = available * speed
            self._add_segment(DRIVING, available, leg_label, miles_delta)
            self.drive_in_shift += available
            self.drive_since_break += available
            self.cycle_used += available
            self.miles_since_fuel += miles_delta
            remaining -= available


def plan_schedule(start_time: datetime, cycle_used: float,
                  legs: list[dict]) -> HOSSimulator:
    """
    Run the full trip simulation.

    `legs` = [leg_to_pickup, leg_to_dropoff] with distance_miles/duration_hours.
    """
    sim = HOSSimulator(start_time=start_time, initial_cycle_used=cycle_used)

    sim.stops.append(StopEvent(
        type="start", label="Trip start — current location",
        start=sim.now, end=sim.now, miles=0.0,
    ))

    sim.drive_leg(legs[0]["distance_miles"], legs[0]["duration_hours"],
                  "Driving to pickup")
    sim.on_duty_task(PICKUP_DURATION, "Pickup — loading (1 hr)", "pickup")

    sim.drive_leg(legs[1]["distance_miles"], legs[1]["duration_hours"],
                  "Driving to drop-off")
    sim.on_duty_task(DROPOFF_DURATION, "Drop-off — unloading (1 hr)", "dropoff")

    return sim
