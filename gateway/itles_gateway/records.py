"""Normalized record = the JSON accepted by POST /api/ingest (see platform/server/ingest.ts)."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Mapping:
    """How device-specific values become engine hours / odometer.

    Defaults follow vendor documents: Galileosky FMS mode puts total engine hours into tag 0xDB
    (value/100 = h) and vehicle distance into 0xC2 (value*5 = m). EGTS has no standard engine-hour
    field (ГОСТ 33472 ABS_CNTR_DATA is an unnamed counter), so it must be configured per device.
    """

    galileo_hours_tag: int | None = 0xDB
    galileo_hours_scale: float = 0.01
    egts_hours_counter: int | None = None
    egts_hours_scale: float = 0.1
    param_hours: dict[str, str] = field(
        default_factory=lambda: {"can_engine_hours": "ecu", "engine_hours": "tracker", "motohours": "tracker"}
    )
    param_hours_scale: float = 1.0
    param_mileage: dict[str, str] = field(
        default_factory=lambda: {"can_mileage": "ecu", "mileage": "tracker", "odometer": "tracker"}
    )
    param_mileage_scale: float = 1.0

    @staticmethod
    def from_dict(d: dict) -> "Mapping":
        m = Mapping()
        for k, v in d.items():
            if hasattr(m, k):
                setattr(m, k, v)
        return m


def clean(rec: dict) -> dict:
    return {k: v for k, v in rec.items() if v is not None}


def params_to_counters(params: dict, mapping: Mapping, rec: dict) -> None:
    for name, method in mapping.param_hours.items():
        v = params.get(name)
        if isinstance(v, (int, float)) and v > 0:
            rec["engine_hours"] = v * mapping.param_hours_scale
            rec["engine_hours_method"] = method
            break
    for name, method in mapping.param_mileage.items():
        v = params.get(name)
        if isinstance(v, (int, float)) and v > 0:
            rec["odometer_km"] = v * mapping.param_mileage_scale
            rec["odometer_method"] = method
            break
