from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import polars as pl
import yaml

logger = logging.getLogger(__name__)


DEFAULT_VEHICLE_CAPACITY_FALLBACK = 100


@dataclass(frozen=True)
class CapacityMeta:
    line_code: str
    expected_capacity_weighted_int: int
    capacity_min: Optional[int] = None
    capacity_max: Optional[int] = None
    confidence: str = "fallback"
    likely_models_topk_json: Optional[str] = None
    notes: Optional[str] = None


class CapacityStore:
    """In-memory lookup for line capacity artifacts.

    Reads parquet snapshots from `data/processed/bus_capacity_snapshots/`.
    If artifacts are missing or a line is absent, returns a safe fallback.
    """

    def __init__(
        self,
        *,
        processed_dir: str = "data/processed/bus_capacity_snapshots",
        rail_capacity_path: str = "config/rail_capacity.yaml",
        vehicle_capacity_fallback: int = DEFAULT_VEHICLE_CAPACITY_FALLBACK,
    ) -> None:
        self.processed_dir = Path(processed_dir)
        self.rail_capacity_path = Path(rail_capacity_path)
        self.vehicle_capacity_fallback = int(vehicle_capacity_fallback)

        self._rep_meta_by_line: Dict[str, Dict[str, Any]] = {}
        self._mix_by_line: Dict[str, List[Dict[str, Any]]] = {}
        self._rail_static_by_line: Dict[str, int] = {}

        self._load()

    def _load(self) -> None:
        # Static rail capacities (optional)
        if self.rail_capacity_path.exists():
            try:
                raw = yaml.safe_load(self.rail_capacity_path.read_text(encoding="utf-8")) or {}
                if not isinstance(raw, dict):
                    raise ValueError("rail_capacity.yaml must be a mapping of line_code -> int")
                for k, v in raw.items():
                    code = str(k or "").strip()
                    if not code:
                        continue
                    try:
                        cap = int(str(v).replace(",", "").strip())
                    except Exception:
                        continue
                    if cap > 0:
                        self._rail_static_by_line[code] = cap
            except Exception as exc:
                logger.exception("Failed to load static rail capacities (%s): %s", self.rail_capacity_path, exc)
        else:
            logger.info("Static rail capacities not found: %s", self.rail_capacity_path)

        rep_path = self.processed_dir / "line_capacity_representative_vehicle.parquet"
        mix_path = self.processed_dir / "line_capacity_vehicle_mix.parquet"

        if rep_path.exists():
            try:
                df = pl.read_parquet(rep_path)
                line_col = "line_code" if "line_code" in df.columns else "line_name" if "line_name" in df.columns else None
                if not line_col:
                    raise ValueError(f"Missing line identifier column in {rep_path}")

                keep_cols = [
                    line_col,
                    "expected_capacity_weighted_int",
                    "capacity_min",
                    "capacity_max",
                    "confidence",
                    "likely_models_topk_json",
                    "notes",
                ]
                existing_keep_cols = [c for c in keep_cols if c in df.columns]
                df = df.select(existing_keep_cols)

                for row in df.iter_rows(named=True):
                    line_code = str(row.get(line_col) or "").strip()
                    if not line_code:
                        continue
                    normalized = {"line_code": line_code, **{k: v for k, v in row.items() if k != line_col}}
                    self._rep_meta_by_line[line_code] = normalized
            except Exception as exc:
                logger.exception("Failed to load capacity representative parquet (%s): %s", rep_path, exc)
        else:
            logger.warning("Capacity representative parquet missing: %s", rep_path)

        if mix_path.exists():
            try:
                df = pl.read_parquet(mix_path)
                line_col = "line_code" if "line_code" in df.columns else "line_name" if "line_name" in df.columns else None
                if not line_col:
                    raise ValueError(f"Missing line identifier column in {mix_path}")

                keep_cols = [
                    line_col,
                    "representative_brand_model",
                    "model_capacity_int",
                    "share_by_vehicles",
                    "occupancy_delta_pct_vs_expected",
                    "n_days_present",
                ]
                existing_keep_cols = [c for c in keep_cols if c in df.columns]
                df = df.select(existing_keep_cols)

                rows_by_line: Dict[str, List[Dict[str, Any]]] = {}
                for row in df.iter_rows(named=True):
                    line_code = str(row.get(line_col) or "").strip()
                    if not line_code:
                        continue
                    normalized = {"line_code": line_code, **{k: v for k, v in row.items() if k != line_col}}
                    rows_by_line.setdefault(line_code, []).append(normalized)

                # Stable ordering (largest share first when available)
                for line_code, rows in rows_by_line.items():
                    rows.sort(key=lambda r: float(r.get("share_by_vehicles") or 0), reverse=True)
                    self._mix_by_line[line_code] = rows
            except Exception as exc:
                logger.exception("Failed to load capacity mix parquet (%s): %s", mix_path, exc)
        else:
            logger.warning("Capacity mix parquet missing: %s", mix_path)

    def get_capacity_meta(self, line_code: str) -> CapacityMeta:
        line_code = (line_code or "").strip()

        # Aliases: forecasts can expose split codes (M1A/M1B) but capacity is defined at M1.
        if line_code in ("M1A", "M1B"):
            line_code = "M1"

        # Static rail override.
        static_cap = self._rail_static_by_line.get(line_code)
        if static_cap:
            return CapacityMeta(
                line_code=line_code,
                expected_capacity_weighted_int=int(static_cap),
                capacity_min=int(static_cap),
                capacity_max=int(static_cap),
                confidence="static",
                notes="Static rail capacity table (per-departure vehicle capacity).",
            )

        row = self._rep_meta_by_line.get(line_code)
        if not row:
            return CapacityMeta(
                line_code=line_code,
                expected_capacity_weighted_int=self.vehicle_capacity_fallback,
                confidence="fallback",
                notes="Capacity artifacts missing or line not found; using fallback vehicle capacity.",
            )

        expected = row.get("expected_capacity_weighted_int")
        try:
            expected_int = int(expected) if expected is not None else self.vehicle_capacity_fallback
        except Exception:
            expected_int = self.vehicle_capacity_fallback

        def _as_int(value: Any) -> Optional[int]:
            if value is None:
                return None
            try:
                return int(value)
            except Exception:
                return None

        return CapacityMeta(
            line_code=line_code,
            expected_capacity_weighted_int=max(1, expected_int),
            capacity_min=_as_int(row.get("capacity_min")),
            capacity_max=_as_int(row.get("capacity_max")),
            confidence=str(row.get("confidence") or "unknown"),
            likely_models_topk_json=row.get("likely_models_topk_json"),
            notes=row.get("notes"),
        )

    def get_capacity_mix(self, line_code: str, *, top_k: int = 10) -> List[Dict[str, Any]]:
        line_code = (line_code or "").strip()
        rows = self._mix_by_line.get(line_code, [])
        if not rows:
            return []
        return rows[: max(1, int(top_k))]
