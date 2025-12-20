"""\
Build bus line capacity snapshots from IETT archive duty service.

For each requested day, fetches (line_code, door_code) assignments from the
IETT SOAP archive endpoint, then left-joins a single vehicle reference file
(door_code -> vehicle attributes + full_capacity_int).

Capacity metrics:
- Per-line mix weights are based on UNIQUE vehicles (n_unique door_code), not
  raw archive record counts.
- expected_capacity_weighted(line) = sum(share_by_vehicles(model) * model_capacity_int)
  where model_capacity_int is the median capacity within that model for the line
  across all requested days (capacity-bearing records only).
- occupancy_delta_pct_vs_expected is defined as:
    (expected_capacity_weighted / model_capacity_int - 1) * 100
  Positive values mean occupancy% would be higher than expected if this (smaller)
  model shows up; negative values mean occupancy% would be lower than expected.

Outputs (default parquet):
- data/interim/bus_capacity_snapshots/arsiv_gorev_YYYYMMDD.parquet
- data/processed/bus_capacity_snapshots/bus_line_vehicle_master.parquet
- data/processed/bus_capacity_snapshots/line_capacity_daily.parquet
- data/processed/bus_capacity_snapshots/line_capacity_representative_vehicle.parquet
- data/processed/bus_capacity_snapshots/line_capacity_vehicle_mix.parquet

Also writes per-day JSON logs to:
- reports/logs/bus_capacity_YYYYMMDD.json

Run:
python -m src.data_prep.build_bus_capacity_snapshots \
  --dates 20251201,20251203 \
  --vehicle-ref-path data/raw/arac_kapasite.csv \
  --out-dir data \
  --format parquet
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date as date_type
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

import httpx
import polars as pl
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


ARCHIVE_URL = "https://api.ibb.gov.tr/iett/ibb/ibb360.asmx"
ARCHIVE_SOAP_ACTION = "http://tempuri.org/GetIettArsivGorev_json"





def _build_soap_envelope(yyyymmdd: str) -> str:
    return f'''<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetIettArsivGorev_json xmlns="http://tempuri.org/">
      <Tarih>{yyyymmdd}</Tarih>
    </GetIettArsivGorev_json>
  </soap:Body>
</soap:Envelope>'''


def _extract_soap_result_text(xml_bytes: bytes, result_tag_localname: str) -> str:
    """Extracts the .text of the first element whose local-name matches."""
    root = ET.fromstring(xml_bytes)
    for elem in root.iter():
        tag = elem.tag
        if isinstance(tag, str) and tag.endswith(f"}}{result_tag_localname}"):
            if elem.text is None:
                return ""
            return elem.text
        if tag == result_tag_localname:
            return elem.text or ""
    return ""


def _parse_archive_json_payload(payload: Any) -> list[dict[str, Any]]:
    """Normalizes JSON payload to a list of record dicts."""
    if payload is None:
        return []
    if isinstance(payload, list):
        return [p for p in payload if isinstance(p, dict)]
    if isinstance(payload, dict):
        # Some SOAP services wrap as {"Table": [...]} or similar.
        for key in ("Table", "table", "data", "Data"):
            value = payload.get(key)
            if isinstance(value, list):
                return [p for p in value if isinstance(p, dict)]
        return [payload]
    return []


@retry(
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=1, min=1, max=12),
    retry=retry_if_exception_type((httpx.HTTPError, ET.ParseError, json.JSONDecodeError, ValueError)),
    reraise=True,
)
def fetch_archive_assignments_json(client: httpx.Client, yyyymmdd: str) -> list[dict[str, Any]]:
    headers = {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": ARCHIVE_SOAP_ACTION,
    }

    # The archive service occasionally responds with an empty SOAP result for a
    # day that *should* have data; do one extra attempt before accepting empty.
    for attempt in range(2):
        response = client.post(
            ARCHIVE_URL,
            content=_build_soap_envelope(yyyymmdd).encode("utf-8"),
            headers=headers,
        )
        response.raise_for_status()

        json_text = _extract_soap_result_text(response.content, "GetIettArsivGorev_jsonResult")
        if not json_text.strip():
            if attempt == 0:
                time.sleep(0.5)
                continue
            return []

        payload = json.loads(json_text)
        records = _parse_archive_json_payload(payload)
        if records:
            return records

        if attempt == 0:
            time.sleep(0.5)
            continue

        return []

    return []


def _parse_yyyymmdd(yyyymmdd: str) -> date_type:
    return datetime.strptime(yyyymmdd, "%Y%m%d").date()


def _normalize_model_expr(expr: pl.Expr) -> pl.Expr:
    return (
        expr.cast(pl.Utf8)
        .str.to_uppercase()
        .str.strip_chars()
        .str.replace_all("/", " ")
        .str.replace_all(r"\s+", " ")
    )


_CAP_RANGE_RE = re.compile(r"(?P<a>\d+(?:[\.,]\d+)?)\s*[-–—]\s*(?P<b>\d+(?:[\.,]\d+)?)")
_CAP_SINGLE_RE = re.compile(r"(?P<v>\d+(?:[\.,]\d+)?)")


def parse_capacity_to_int(value: Any) -> int | None:
    if value is None:
        return None

    text = str(value).strip()
    if not text:
        return None

    text = text.replace("kiş", "").replace("KİŞ", "").replace("Kisi", "").strip()
    text = text.replace(",", ".")

    m = _CAP_RANGE_RE.search(text)
    if m:
        a = float(m.group("a"))
        b = float(m.group("b"))
        return int(round((a + b) / 2.0))

    m = _CAP_SINGLE_RE.search(text)
    if m:
        return int(round(float(m.group("v"))))

    return None
def _read_vehicle_reference(path: Path) -> tuple[pl.DataFrame, int]:
    if path.suffix.lower() in {".xlsx", ".xls"}:
        import pandas as pd

        pdf = pd.read_excel(path)
        df = pl.from_pandas(pdf)
    else:
        df = pl.read_csv(path, infer_schema_length=10_000, ignore_errors=True)

    rename_map = {
        "Kapı Kodu": "door_code",
        "Plaka": "plate",
        "Model Yılı": "model_year",
        "Marka": "brand_model_raw",
        "Tip": "vehicle_type_raw",
        "İşletmeci": "operator_raw",
    }
    existing = set(df.columns)
    df = df.rename({k: v for k, v in rename_map.items() if k in existing})
    if "full_capacity" in df.columns:
        df = df.rename({"full_capacity": "full_capacity_raw"})

    required = {"door_code", "plate", "model_year", "brand_model_raw", "vehicle_type_raw", "operator_raw", "full_capacity_raw"}
    missing = sorted(required - set(df.columns))
    if missing:
        raise ValueError(f"Vehicle reference missing required columns: {missing}")

    df = df.with_columns(
        door_code=pl.col("door_code").cast(pl.Utf8).str.strip_chars(),
        plate=pl.col("plate").cast(pl.Utf8),
        brand_model_raw=pl.col("brand_model_raw").cast(pl.Utf8),
        vehicle_type_raw=pl.col("vehicle_type_raw").cast(pl.Utf8),
        operator_raw=pl.col("operator_raw").cast(pl.Utf8),
        model_year=pl.col("model_year").cast(pl.Int64, strict=False),
        full_capacity_int=pl.col("full_capacity_raw").map_elements(parse_capacity_to_int, return_dtype=pl.Int64),
        in_ref=pl.lit(True),
    )

    df = df.filter(pl.col("door_code").is_not_null() & (pl.col("door_code") != ""))
    total = df.height
    dedup = df.unique(subset=["door_code"], keep="first")
    n_duplicate = total - dedup.height
    return dedup.select(
        [
            "door_code",
            "plate",
            "model_year",
            "brand_model_raw",
            "vehicle_type_raw",
            "operator_raw",
            "full_capacity_int",
            "in_ref",
        ]
    ), int(n_duplicate)


def _records_to_snapshot_df(records: list[dict[str, Any]], yyyymmdd: str) -> tuple[pl.DataFrame, dict[str, int]]:
    parsed_date = _parse_yyyymmdd(yyyymmdd)

    rows: list[dict[str, Any]] = []
    for rec in records:
        v_line = rec.get("SHATKODU")
        line_code = None if v_line is None else str(v_line).strip()
        if line_code == "":
            line_code = None

        v_door = rec.get("SKAPINUMARA")
        door_code = None if v_door is None else str(v_door).strip()
        if door_code == "":
            door_code = None
        rows.append({"date": parsed_date, "line_code": line_code, "door_code": door_code})

    raw_df = pl.DataFrame(
        rows,
        schema={
            "date": pl.Date,
            "line_code": pl.Utf8,
            "door_code": pl.Utf8,
        },
    )
    raw_count = raw_df.height

    df = raw_df.with_columns(
        pl.col("line_code").cast(pl.Utf8).str.strip_chars(),
        pl.col("door_code").cast(pl.Utf8).str.strip_chars(),
    )
    df = df.filter(pl.col("line_code").is_not_null() & (pl.col("line_code") != ""))

    invalid_door_mask = (
        pl.col("door_code").is_null()
        | (pl.col("door_code").cast(pl.Utf8) == "")
        | pl.col("door_code").cast(pl.Utf8).str.strip_chars().str.to_uppercase().is_in(["NONE", "NULL", "NAN"])
    )
    n_invalid_door_code = df.filter(invalid_door_mask).height
    df = df.filter(~invalid_door_mask)

    # Dedupe: same door_code within same hat/day should be a single record.
    df = df.unique(subset=["date", "line_code", "door_code"], keep="first")
    stats = {
        "n_archive_rows": raw_count,
        "n_invalid_door_code": n_invalid_door_code,
    }
    return df, stats


def _write_df(df: pl.DataFrame, path: Path, fmt: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if fmt == "parquet":
        df.write_parquet(path)
    elif fmt == "csv":
        df.write_csv(path)
    else:
        raise ValueError(f"Unsupported format: {fmt}")


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, default=str)


@dataclass(frozen=True)
class DayResult:
    yyyymmdd: str
    snapshot_df: pl.DataFrame | None
    master_df: pl.DataFrame | None
    log_payload: dict[str, Any]


def _process_day(
    *,
    client: httpx.Client,
    yyyymmdd: str,
    vehicle_ref: pl.DataFrame,
    n_duplicate_door_codes_in_ref: int,
    interim_dir: Path,
    fmt: str,
    logs_dir: Path,
) -> DayResult:
    log_path = logs_dir / f"bus_capacity_{yyyymmdd}.json"

    try:
        records = fetch_archive_assignments_json(client, yyyymmdd)
        snapshot_df, base_stats = _records_to_snapshot_df(records, yyyymmdd)

        # A) daily snapshot
        snapshot_path = interim_dir / f"arsiv_gorev_{yyyymmdd}.{fmt}"
        _write_df(snapshot_df.select(["date", "line_code", "door_code"]), snapshot_path, fmt)

        # Log: door appearing on multiple lines same day.
        n_doors_multi_line_same_day = (
            snapshot_df.group_by("door_code")
            .agg(pl.n_unique("line_code").alias("n_lines"))
            .filter(pl.col("n_lines") > 1)
            .height
        )

        # Join with vehicle reference.
        master_df = snapshot_df.join(vehicle_ref, on="door_code", how="left")

        # Day-level metrics.
        n_unique_lines = snapshot_df.select(pl.col("line_code").n_unique()).item()
        n_unique_doors = snapshot_df.select(pl.col("door_code").n_unique()).item()

        n_doors_with_ref = (
            master_df.filter(pl.col("in_ref").is_not_null()).select(pl.col("door_code").n_unique()).item()
        )
        missing_ref_rate = None
        if n_unique_doors:
            missing_ref_rate = float(1.0 - (n_doors_with_ref / n_unique_doors))

        n_doors_with_capacity = (
            master_df.filter(pl.col("full_capacity_int").is_not_null()).select(pl.col("door_code").n_unique()).item()
        )
        missing_capacity_rate = None
        if n_unique_doors:
            missing_capacity_rate = float(1.0 - (n_doors_with_capacity / n_unique_doors))

        top_missing_door_codes = (
            master_df.filter(
                pl.col("in_ref").is_null()
                & pl.col("door_code").is_not_null()
                & (pl.col("door_code") != "")
                & (~pl.col("door_code").str.strip_chars().str.to_uppercase().is_in(["NONE", "NULL", "NAN"]))
            )
            .group_by("door_code")
            .agg(pl.len().alias("count"))
            .sort(["count", "door_code"], descending=[True, False])
            .head(20)
            .to_dicts()
        )

        log_payload: dict[str, Any] = {
            "date": yyyymmdd,
            **base_stats,
            "n_unique_lines": int(n_unique_lines),
            "n_unique_doors": int(n_unique_doors),
            "n_doors_multi_line_same_day": int(n_doors_multi_line_same_day),
            "n_doors_with_ref": int(n_doors_with_ref),
            "missing_ref_rate": missing_ref_rate,
            "n_doors_with_capacity": int(n_doors_with_capacity),
            "missing_capacity_rate": missing_capacity_rate,
            "n_duplicate_door_codes_in_ref": int(n_duplicate_door_codes_in_ref),
            "top_missing_door_codes": top_missing_door_codes,
        }
        _write_json(log_path, log_payload)
        if n_doors_multi_line_same_day:
            logger.warning(
                "Day %s: %s door_code values appear on multiple lines (kept per-line).",
                yyyymmdd,
                n_doors_multi_line_same_day,
            )

        return DayResult(yyyymmdd=yyyymmdd, snapshot_df=snapshot_df, master_df=master_df, log_payload=log_payload)

    except Exception as e:  # noqa: BLE001
        logger.exception("Failed processing day %s", yyyymmdd)
        log_payload = {
            "date": yyyymmdd,
            "error": str(e),
        }
        _write_json(log_path, log_payload)
        return DayResult(yyyymmdd=yyyymmdd, snapshot_df=None, master_df=None, log_payload=log_payload)


def _compute_daily_line_summary(master_df: pl.DataFrame) -> pl.DataFrame:
    base = (
        master_df.group_by(["date", "line_code"])
        .agg(
            pl.col("door_code").n_unique().alias("n_vehicles_total"),
            pl.col("door_code")
            .filter(pl.col("full_capacity_int").is_not_null())
            .n_unique()
            .alias("n_vehicles_with_capacity"),
            pl.mean("full_capacity_int").alias("avg_full_capacity"),
            pl.median("full_capacity_int").alias("median_full_capacity"),
        )
        .with_columns(
            missing_capacity_rate=(
                pl.when(pl.col("n_vehicles_total") > 0)
                .then(1.0 - (pl.col("n_vehicles_with_capacity") / pl.col("n_vehicles_total")))
                .otherwise(None)
            )
        )
    )

    # Daily weighted expected capacity using that day's capacity-bearing vehicle mix.
    daily_mix = (
        master_df.filter(pl.col("full_capacity_int").is_not_null() & pl.col("brand_model_raw").is_not_null())
        .with_columns(brand_model_norm=_normalize_model_expr(pl.col("brand_model_raw")))
        .group_by(["date", "line_code", "brand_model_norm"])
        .agg(
            pl.col("door_code").n_unique().alias("model_frequency_vehicles"),
            pl.median("full_capacity_int").round().cast(pl.Int64).alias("model_capacity_int"),
        )
    )
    daily_mix = daily_mix.join(
        base.select(["date", "line_code", "n_vehicles_with_capacity"]),
        on=["date", "line_code"],
        how="left",
    ).with_columns(
        share_by_vehicles=(pl.col("model_frequency_vehicles") / pl.col("n_vehicles_with_capacity")).cast(pl.Float64)
    )
    daily_expected = (
        daily_mix.group_by(["date", "line_code"])
        .agg((pl.col("share_by_vehicles") * pl.col("model_capacity_int")).sum().alias("expected_capacity_weighted_daily"))
        .with_columns(pl.col("expected_capacity_weighted_daily").round(2))
    )

    return (
        base.join(daily_expected, on=["date", "line_code"], how="left")
        .select(
            [
                "date",
                "line_code",
                "n_vehicles_total",
                "n_vehicles_with_capacity",
                "missing_capacity_rate",
                pl.col("avg_full_capacity").round(2).alias("avg_full_capacity"),
                pl.col("median_full_capacity").round().cast(pl.Int64).alias("median_full_capacity"),
                "expected_capacity_weighted_daily",
            ]
        )
        .sort(["date", "line_code"])
    )


def _compute_line_vehicle_mix(
    master_df: pl.DataFrame, *, top_k_mix: int
) -> tuple[pl.DataFrame, pl.DataFrame, pl.DataFrame]:
    """Returns (mix_all, mix_topk, line_expected_stats) computed from capacity-bearing records."""
    cap = master_df.filter(pl.col("full_capacity_int").is_not_null() & pl.col("brand_model_raw").is_not_null())
    if cap.height == 0:
        empty_mix = pl.DataFrame(
            schema={
                "line_code": pl.Utf8,
                "brand_model_norm": pl.Utf8,
                "representative_brand_model": pl.Utf8,
                "model_capacity_int": pl.Int64,
                "model_frequency_vehicles": pl.Int64,
                "model_frequency_records": pl.Int64,
                "share_by_vehicles": pl.Float64,
                "share_by_records": pl.Float64,
                "n_days_present": pl.Int64,
                "capacity_min_within_model": pl.Int64,
                "capacity_max_within_model": pl.Int64,
            }
        )
        empty_expected = pl.DataFrame(
            schema={
                "line_code": pl.Utf8,
                "n_days_observed": pl.Int64,
                "n_vehicles_total": pl.Int64,
                "n_vehicles_with_capacity_total": pl.Int64,
                "missing_capacity_rate": pl.Float64,
                "expected_capacity_weighted": pl.Float64,
                "expected_capacity_weighted_int": pl.Int64,
                "capacity_min": pl.Int64,
                "capacity_max": pl.Int64,
                "capacity_mean": pl.Float64,
                "capacity_median": pl.Int64,
                "target_capacity_mean": pl.Float64,
                "target_capacity_median": pl.Int64,
                "capacity_std": pl.Float64,
                "p10_capacity": pl.Float64,
                "p90_capacity": pl.Float64,
                "total_capacity_records": pl.Int64,
            }
        )
        empty_mix_topk = empty_mix
        return empty_mix, empty_mix_topk, empty_expected

    cap = cap.with_columns(brand_model_norm=_normalize_model_expr(pl.col("brand_model_raw")))

    mix_all = (
        cap.group_by(["line_code", "brand_model_norm"])
        .agg(
            pl.col("door_code").n_unique().alias("model_frequency_vehicles"),
            pl.len().alias("model_frequency_records"),
            pl.n_unique("date").alias("n_days_present"),
            pl.median("full_capacity_int").round().cast(pl.Int64).alias("model_capacity_int"),
            pl.min("full_capacity_int").round().cast(pl.Int64).alias("capacity_min_within_model"),
            pl.max("full_capacity_int").round().cast(pl.Int64).alias("capacity_max_within_model"),
            pl.col("brand_model_raw").drop_nulls().sort().first().alias("representative_brand_model"),
        )
        .sort(["line_code", "model_frequency_vehicles", "brand_model_norm"], descending=[False, True, False])
    )

    line_base = (
        master_df.group_by("line_code")
        .agg(
            pl.n_unique("date").alias("n_days_observed"),
            pl.col("door_code").n_unique().alias("n_vehicles_total"),
            pl.col("door_code").filter(pl.col("full_capacity_int").is_not_null()).n_unique().alias(
                "n_vehicles_with_capacity_total"
            ),
        )
        .with_columns(
            missing_capacity_rate=(
                pl.when(pl.col("n_vehicles_total") > 0)
                .then(1.0 - (pl.col("n_vehicles_with_capacity_total") / pl.col("n_vehicles_total")))
                .otherwise(None)
            )
        )
    )

    line_capacity_stats = (
        cap.group_by("line_code")
        .agg(
            pl.len().alias("total_capacity_records"),
            pl.min("full_capacity_int").round().cast(pl.Int64).alias("capacity_min"),
            pl.max("full_capacity_int").round().cast(pl.Int64).alias("capacity_max"),
            pl.mean("full_capacity_int").alias("capacity_mean"),
            pl.median("full_capacity_int").round().cast(pl.Int64).alias("capacity_median"),
            pl.std("full_capacity_int").alias("capacity_std"),
            pl.quantile("full_capacity_int", 0.10, "nearest").alias("p10_capacity"),
            pl.quantile("full_capacity_int", 0.90, "nearest").alias("p90_capacity"),
        )
        .with_columns(
            capacity_mean=pl.col("capacity_mean").round(2),
            capacity_std=pl.col("capacity_std").round(2),
            p10_capacity=pl.col("p10_capacity").round(2),
            p90_capacity=pl.col("p90_capacity").round(2),
        )
    )

    mix_all = mix_all.join(
        line_base.select(["line_code", "n_vehicles_with_capacity_total"]),
        on="line_code",
        how="left",
    ).join(
        line_capacity_stats.select(["line_code", "total_capacity_records"]),
        on="line_code",
        how="left",
    ).with_columns(
        share_by_vehicles=(pl.col("model_frequency_vehicles") / pl.col("n_vehicles_with_capacity_total")).cast(pl.Float64),
        share_by_records=(pl.col("model_frequency_records") / pl.col("total_capacity_records")).cast(pl.Float64),
    )

    expected_capacity_weighted = (
        mix_all.group_by("line_code")
        .agg((pl.col("share_by_vehicles") * pl.col("model_capacity_int")).sum().alias("expected_capacity_weighted"))
        .with_columns(
            expected_capacity_weighted=pl.col("expected_capacity_weighted").round(2),
            expected_capacity_weighted_int=pl.col("expected_capacity_weighted").round().cast(pl.Int64),
        )
    )

    line_expected_stats = (
        line_base.join(line_capacity_stats, on="line_code", how="left")
        .join(expected_capacity_weighted, on="line_code", how="left")
        .with_columns(
            target_capacity_mean=pl.col("capacity_mean"),
            target_capacity_median=pl.col("capacity_median"),
        )
    )

    mix_all = mix_all.drop(["n_vehicles_with_capacity_total", "total_capacity_records"], strict=False)
    mix_topk = (
        mix_all.sort(["line_code", "model_frequency_vehicles", "brand_model_norm"], descending=[False, True, False])
        .group_by("line_code", maintain_order=True)
        .head(top_k_mix)
    )

    return mix_all, mix_topk, line_expected_stats





def _compute_representative_vehicles(
    master_df: pl.DataFrame,
    *,
    min_k: int,
    top_k_mix: int,
) -> tuple[pl.DataFrame, pl.DataFrame]:
    mix_all, mix_topk, line_expected_stats = _compute_line_vehicle_mix(master_df, top_k_mix=top_k_mix)

    # Representative model selection uses frequency-first ordering.
    candidates = mix_all.join(
        line_expected_stats.select(["line_code", "target_capacity_median", "n_vehicles_with_capacity_total", "missing_capacity_rate"]),
        on="line_code",
        how="left",
    ).with_columns(
        distance=(pl.col("model_capacity_int") - pl.col("target_capacity_median")).abs(),
        representative_share=pl.col("share_by_vehicles"),
    )

    ranked = candidates.sort(
        [
            "line_code",
            "model_frequency_vehicles",
            "distance",
            "n_days_present",
            "brand_model_norm",
        ],
        descending=[False, True, False, True, False],
    )
    winners = ranked.unique(subset=["line_code"], keep="first").select(
        [
            "line_code",
            pl.col("representative_brand_model").alias("representative_brand_model"),
            pl.col("model_capacity_int").alias("representative_full_capacity_int"),
            "representative_share",
        ]
    )

    base = line_expected_stats.join(winners, on="line_code", how="left")

    def _confidence_expr() -> pl.Expr:
        return (
            pl.when(pl.col("n_vehicles_with_capacity_total") == 0)
            .then(pl.lit("no_data"))
            .when(pl.col("missing_capacity_rate") > 0.40)
            .then(pl.lit("low"))
            .when(pl.col("n_vehicles_with_capacity_total") < min_k)
            .then(pl.lit("insufficient_data"))
            .when((pl.col("missing_capacity_rate") <= 0.20) & (pl.col("representative_share") >= 0.35))
            .then(pl.lit("high"))
            .otherwise(pl.lit("medium"))
        )

    def _notes_expr() -> pl.Expr:
        return (
            pl.when(pl.col("n_vehicles_with_capacity_total") == 0)
            .then(pl.lit("no capacity-bearing vehicles observed"))
            .when(pl.col("missing_capacity_rate") > 0.40)
            .then(pl.lit("missing_capacity_rate > 0.40"))
            .when(pl.col("n_vehicles_with_capacity_total") < min_k)
            .then(pl.format("n_vehicles_with_capacity_total < {}", pl.lit(min_k)))
            .when((pl.col("missing_capacity_rate") <= 0.20) & (pl.col("representative_share") >= 0.35))
            .then(pl.lit("strong coverage + representative share"))
            .otherwise(pl.lit(""))
        )

    # Compact top-5 list for UI tooltips.
    top5 = (
        mix_all.sort(["line_code", "share_by_vehicles", "brand_model_norm"], descending=[False, True, False])
        .group_by("line_code", maintain_order=True)
        .agg(
            pl.struct(
                [
                    pl.col("representative_brand_model").alias("brand_model"),
                    pl.col("model_capacity_int").alias("model_capacity_int"),
                    pl.col("share_by_vehicles").round(4).alias("share_by_vehicles"),
                ]
            )
            .head(5)
            .alias("_likely_models")
        )
        .with_columns(
            likely_models_topk_json=pl.col("_likely_models").map_elements(
                lambda xs: json.dumps(xs.to_list() if hasattr(xs, "to_list") else xs, ensure_ascii=False),
                return_dtype=pl.Utf8,
            )
        )
        .select(["line_code", "likely_models_topk_json"])
    )

    result = (
        base.join(top5, on="line_code", how="left")
        .with_columns(confidence=_confidence_expr(), notes=_notes_expr())
        .with_columns(
            # For no_data lines, wipe representative + weighted fields.
            representative_brand_model=pl.when(pl.col("confidence") == "no_data")
            .then(None)
            .otherwise(pl.col("representative_brand_model")),
            representative_full_capacity_int=pl.when(pl.col("confidence") == "no_data")
            .then(None)
            .otherwise(pl.col("representative_full_capacity_int")),
            representative_share=pl.when(pl.col("confidence") == "no_data")
            .then(None)
            .otherwise(pl.col("representative_share")),
            likely_models_topk_json=pl.when(pl.col("confidence") == "no_data")
            .then(None)
            .otherwise(pl.col("likely_models_topk_json")),
            expected_capacity_weighted=pl.when(pl.col("confidence") == "no_data")
            .then(None)
            .otherwise(pl.col("expected_capacity_weighted")),
            expected_capacity_weighted_int=pl.when(pl.col("confidence") == "no_data")
            .then(None)
            .otherwise(pl.col("expected_capacity_weighted_int")),
            capacity_min=pl.when(pl.col("confidence") == "no_data").then(None).otherwise(pl.col("capacity_min")),
            capacity_max=pl.when(pl.col("confidence") == "no_data").then(None).otherwise(pl.col("capacity_max")),
            capacity_mean=pl.when(pl.col("confidence") == "no_data").then(None).otherwise(pl.col("capacity_mean")),
            capacity_median=pl.when(pl.col("confidence") == "no_data").then(None).otherwise(pl.col("capacity_median")),
        )
        .select(
            [
                "line_code",
                "target_capacity_median",
                "target_capacity_mean",
                "expected_capacity_weighted",
                "expected_capacity_weighted_int",
                "capacity_min",
                "capacity_max",
                "capacity_mean",
                "capacity_median",
                "capacity_std",
                "p10_capacity",
                "p90_capacity",
                "representative_brand_model",
                "representative_full_capacity_int",
                "representative_share",
                "n_days_observed",
                "n_vehicles_with_capacity_total",
                "confidence",
                "likely_models_topk_json",
                "notes",
            ]
        )
        .sort("line_code")
    )

    # Add occupancy sensitivity to mix_topk using expected weighted capacity.
    mix_topk = mix_topk.join(
        result.select(["line_code", "expected_capacity_weighted"]),
        on="line_code",
        how="left",
    ).with_columns(
        occupancy_multiplier_vs_expected=(
            pl.when(pl.col("expected_capacity_weighted").is_not_null() & (pl.col("model_capacity_int") > 0))
            .then((pl.col("model_capacity_int") / pl.col("expected_capacity_weighted")).cast(pl.Float64))
            .otherwise(None)
        ).round(3),
        occupancy_delta_pct_vs_expected=(
            pl.when(pl.col("expected_capacity_weighted").is_not_null() & (pl.col("model_capacity_int") > 0))
            .then(((pl.col("expected_capacity_weighted") / pl.col("model_capacity_int")) - 1.0) * 100.0)
            .otherwise(None)
        ).round(1),
    )

    mix_topk = mix_topk.select(
        [
            "line_code",
            "brand_model_norm",
            "representative_brand_model",
            "model_capacity_int",
            "model_frequency_vehicles",
            "model_frequency_records",
            "share_by_vehicles",
            "share_by_records",
            "n_days_present",
            "capacity_min_within_model",
            "capacity_max_within_model",
            "occupancy_multiplier_vs_expected",
            "occupancy_delta_pct_vs_expected",
        ]
    ).sort(["line_code", "model_frequency_vehicles", "brand_model_norm"], descending=[False, True, False])

    return result, mix_topk


def parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build bus capacity snapshots from IETT archive duty data.")
    parser.add_argument(
        "--dates",
        required=True,
        help="Comma-separated yyyyMMdd list (e.g., 20251201,20251202)",
    )
    parser.add_argument(
        "--vehicle-ref-path",
        default="data/raw/arac_kapasite.csv",
        help="Vehicle reference (door_code -> vehicle attributes + full_capacity).",
    )
    parser.add_argument(
        "--out-dir",
        default="data",
        help="Base output directory (default: data).",
    )
    parser.add_argument(
        "--format",
        default="parquet",
        choices=["parquet", "csv"],
        help="Output format (default: parquet).",
    )
    parser.add_argument(
        "--min-k",
        type=int,
        default=3,
        help="Minimum capacity-bearing vehicles per line for confidence labeling (default: 3).",
    )
    parser.add_argument(
        "--top-k-mix",
        type=int,
        default=10,
        help="Keep top K models per line in vehicle mix output (default: 10).",
    )
    parser.add_argument(
        "--impute-no-data",
        action="store_true",
        help="Optionally apply offline no-data capacity imputation after writing representative/daily tables.",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=float,
        default=30.0,
        help="HTTP timeout per request.",
    )
    return parser.parse_args(argv)


def main(argv: Iterable[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

    args = parse_args(argv)
    dates = [d.strip() for d in args.dates.split(",") if d.strip()]
    if not dates:
        raise ValueError("--dates is empty")

    out_dir = Path(args.out_dir)
    interim_dir = out_dir / "interim" / "bus_capacity_snapshots"
    processed_dir = out_dir / "processed" / "bus_capacity_snapshots"
    logs_dir = Path("reports") / "logs"

    vehicle_ref_path = Path(args.vehicle_ref_path)
    vehicle_ref, n_duplicate_door_codes_in_ref = _read_vehicle_reference(vehicle_ref_path)

    master_dfs: list[pl.DataFrame] = []

    with httpx.Client(timeout=httpx.Timeout(args.timeout_seconds)) as client:
        for yyyymmdd in dates:
            # Avoid hammering the service.
            time.sleep(0.05)
            result = _process_day(
                client=client,
                yyyymmdd=yyyymmdd,
                vehicle_ref=vehicle_ref,
                n_duplicate_door_codes_in_ref=n_duplicate_door_codes_in_ref,
                interim_dir=interim_dir,
                fmt=args.format,
                logs_dir=logs_dir,
            )
            if result.master_df is not None:
                master_dfs.append(result.master_df)

    if not master_dfs:
        logger.warning("No successful days processed; skipping processed outputs.")
        return

    # B) processed master
    master_df = pl.concat(master_dfs, how="vertical")
    if master_df.height == 0:
        logger.warning("No rows in master across all days; writing only interim + logs")
        return
    master_path = processed_dir / f"bus_line_vehicle_master.{args.format}"
    _write_df(
        master_df.select(
            [
                "date",
                "line_code",
                "door_code",
                "plate",
                "model_year",
                "brand_model_raw",
                "vehicle_type_raw",
                "operator_raw",
                "full_capacity_int",
            ]
        ),
        master_path,
        args.format,
    )

    # C) daily line summary
    daily_summary = _compute_daily_line_summary(master_df)
    # D) representative per line + mix
    representative, mix_topk = _compute_representative_vehicles(
        master_df,
        min_k=args.min_k,
        top_k_mix=args.top_k_mix,
    )

    daily_summary_path = processed_dir / f"line_capacity_daily.{args.format}"
    _write_df(daily_summary, daily_summary_path, args.format)

    rep_path = processed_dir / f"line_capacity_representative_vehicle.{args.format}"
    _write_df(representative, rep_path, args.format)

    if args.impute_no_data:
        from src.data_prep.impute_no_data_line_capacities import _impute_no_data_lines as _impute
        from src.data_prep.impute_no_data_line_capacities import NO_DATA_LINES as _NO_DATA_LINES

        rep2, daily2, n_rep_imputed, n_daily_imputed = _impute(representative, daily_summary)
        logger.info("No-data imputation applied (representative=%s, daily=%s)", n_rep_imputed, n_daily_imputed)

        missing = (
            rep2.filter(pl.col("line_code").is_in(_NO_DATA_LINES))
            .filter(pl.col("expected_capacity_weighted_int").is_null())
            .select("line_code")
            .to_series()
            .to_list()
        )
        if missing:
            logger.warning("NO_DATA_LINES still missing expected_capacity_weighted_int after imputation: %s", missing)

        _write_df(daily2, daily_summary_path, args.format)
        _write_df(rep2, rep_path, args.format)

    # E) per-line vehicle mix (for UI explanations)
    mix_path = processed_dir / f"line_capacity_vehicle_mix.{args.format}"
    _write_df(mix_topk, mix_path, args.format)

    logger.info("Wrote processed outputs under %s", processed_dir)


if __name__ == "__main__":
    main()
