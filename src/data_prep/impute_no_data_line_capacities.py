"""\
Offline imputation for bus line capacities with no observed capacity-bearing vehicles.

This module patches already-produced processed outputs under
`data/processed/bus_capacity_snapshots/` without re-fetching IETT archive data.

Two-step workflow:
1) Build snapshots (calls SOAP):
   `python -m src.data_prep.build_bus_capacity_snapshots --dates ... --format parquet`
2) Impute no-data lines (offline):
   `python -m src.data_prep.impute_no_data_line_capacities \
      --processed-dir data/processed/bus_capacity_snapshots \
      --format parquet \
      --inplace`

The imputation only applies to a fixed set of known lines (`NO_DATA_LINES`) and
only when the representative table has `confidence == "no_data"`.

No network calls are performed.
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Iterable

import polars as pl

logger = logging.getLogger(__name__)


# IMPORTANT: Keep this list EXACT (do not change content).
NO_DATA_LINES: list[str] = [
    "11G",
    "11P",
    "122H",
    "122V",
    "122Y",
    "122ÇK",
    "130A",
    "130E",
    "130H",
    "130T",
    "131K",
    "131SB",
    "132",
    "132A",
    "132B",
    "132D",
    "132E",
    "132F",
    "132G",
    "132H",
    "132K",
    "132M",
    "132R",
    "132Ş",
    "133",
    "133A",
    "133B",
    "133T",
    "134",
    "134A",
    "134B",
    "134C",
    "134CK",
    "134GK",
    "134UK",
    "134YK",
    "135G",
    "145M",
    "14AK",
    "14CE",
    "14S",
    "14T",
    "14YE",
    "150",
    "154",
    "16A",
    "16D",
    "18Y",
    "19",
    "19A",
    "19B",
    "19E",
    "19F",
    "19K",
    "19M",
    "19S",
    "19T",
    "19V",
    "2",
    "20",
    "20A",
    "20B",
    "20C",
    "20D",
    "20K",
    "20P",
    "20S",
    "20SB",
    "20T",
    "20U",
    "20V",
    "20Y",
    "20Z",
    "21",
    "21A",
    "21B",
    "21E",
    "21F",
    "21G",
    "21H",
    "21K",
    "21M",
    "21P",
    "21T",
    "21U",
    "21V",
    "21Y",
    "22",
    "22A",
    "22B",
    "22C",
    "22G",
    "22H",
    "22M",
    "22RE",
    "22S",
    "22Ş",
    "22U",
    "22Y",
    "23A",
    "23B",
    "23C",
    "23G",
    "23K",
    "23R",
    "23Ş",
    "23U",
    "23Y",
    "24",
    "24A",
    "24B",
    "24C",
    "24E",
    "24M",
    "24S",
    "24Ş",
    "24U",
    "24Y",
    "25",
    "251",
    "29C",
    "300",
    "300B",
    "300C",
    "300D",
    "300G",
    "300M",
    "303A",
    "320Y",
    "336Y",
    "402",
    "403",
    "404",
    "AND2S",
    "AND2Y",
    "DS1",
    "DS2",
    "EL2",
    "FB2",
    "GZ1",
    "HM1",
    "KA-2",
    "KM2",
    "KM3",
    "SG-1",
    "SG-2",
    "SM2",
    "SM3",
    "SM4",
    "SM6",
    "THSS_2",
    "THSS_6",
    "TM6",
]


# IMPORTANT: Keep this mapping EXACT (do not change content).
NO_DATA_LINE_TYPE_OVERRIDES: dict[str, str] = {
    # double-decker list
    "16D": "ÇİFT KATLI",
    "145M": "ÇİFT KATLI",
    "251": "ÇİFT KATLI",
    # DHE
    "SG-1": "DHE",
    "SG-2": "DHE",
    # confirmed from RouteDetail pages
    "DS1": "BESLEME",
    "11G": "NORMAL",
    "300": "NORMAL",
    "EL2": "NORMAL",
    "AND2S": "NORMAL",
    # special types -> mapped categories
    "GZ1": "RİNG",
    "122H": "2.BOĞAZGEÇ",
}


def _map_iett_type_to_imputation(iett_type: str | None) -> tuple[str, int, str]:
    """Maps IETT 'Hat Tipi' to (model_label, capacity_int, mapped_type).

    Rules:
    - RİNG => BESLEME defaults
    - BOĞAZGEÇ / 2.BOĞAZGEÇ => treat as high-capacity cross-city: articulated 150
    - Unknown => NORMAL
    """

    if not iett_type:
        mapped = "NORMAL"
    else:
        raw = str(iett_type).strip().upper()
        if raw in {"NORMAL", "BESLEME", "BÖLGESEL", "BOLGESEL", "EKSPRES", "DHE", "ÇİFT KATLI", "CIFT KATLI"}:
            mapped = raw
        elif "RİNG" in raw or "RING" in raw:
            mapped = "RİNG"
        elif "BOĞAZ" in raw or "BOGAZ" in raw:
            mapped = "BOĞAZGEÇ"
        else:
            mapped = "NORMAL"

    if mapped in {"ÇİFT KATLI", "CIFT KATLI"}:
        return "Akia Ultra DD", 73, "ÇİFT KATLI"
    if mapped == "DHE":
        return "Mercedes Capacity", 193, "DHE"
    if mapped == "EKSPRES":
        return "Mercedes Citaro 0530 G", 150, "EKSPRES"
    if mapped in {"BÖLGESEL", "BOLGESEL"}:
        return "Otokar Kent 290 LF", 102, "BÖLGESEL"
    if mapped == "BESLEME":
        return "Karsan Avancity S Plus", 95, "BESLEME"
    if mapped == "RİNG":
        return "Karsan Avancity S Plus", 95, "RİNG"
    if mapped == "BOĞAZGEÇ":
        return "Mercedes Citaro 0530 G", 150, "BOĞAZGEÇ"

    return "Otokar Kent 290 LF", 102, "NORMAL"


def _impute_no_data_lines(
    representative_df: pl.DataFrame,
    daily_df: pl.DataFrame,
) -> tuple[pl.DataFrame, pl.DataFrame, int, int]:
    """Apply deterministic imputation to representative + daily tables.

    Returns:
      (representative_df, daily_df, n_rep_imputed, n_daily_imputed)
    """

    if representative_df.is_empty():
        return representative_df, daily_df, 0, 0

    no_data_set = set(NO_DATA_LINES)

    imputed_rows: list[dict[str, object]] = []
    for line_code in NO_DATA_LINES:
        iett_type = NO_DATA_LINE_TYPE_OVERRIDES.get(line_code)
        model_label, cap_int, mapped_type = _map_iett_type_to_imputation(iett_type)
        imputed_rows.append(
            {
                "line_code": line_code,
                "_imputed_model_label": model_label,
                "_imputed_capacity_int": int(cap_int),
                "_imputed_type": mapped_type,
            }
        )

    imputed = pl.DataFrame(imputed_rows).with_columns(
        pl.col("_imputed_capacity_int").cast(pl.Int64),
        pl.col("_imputed_model_label").cast(pl.Utf8),
        pl.col("_imputed_type").cast(pl.Utf8),
    )

    rep2 = representative_df.join(imputed, on="line_code", how="left")
    rep2 = rep2.with_columns(
        _should_impute=(
            pl.col("line_code").is_in(list(no_data_set))
            & (pl.col("confidence") == "no_data")
            & pl.col("_imputed_capacity_int").is_not_null()
        )
    )
    n_rep_imputed = int(rep2.filter(pl.col("_should_impute")).height)

    rep2 = rep2.with_columns(
        representative_brand_model=pl.when(pl.col("_should_impute")).then(pl.col("_imputed_model_label")).otherwise(
            pl.col("representative_brand_model")
        ),
        representative_full_capacity_int=pl.when(pl.col("_should_impute")).then(pl.col("_imputed_capacity_int")).otherwise(
            pl.col("representative_full_capacity_int")
        ),
        representative_share=pl.when(pl.col("_should_impute")).then(pl.lit(1.0)).otherwise(pl.col("representative_share")),
        expected_capacity_weighted=pl.when(pl.col("_should_impute"))
        .then(pl.col("_imputed_capacity_int").cast(pl.Float64))
        .otherwise(pl.col("expected_capacity_weighted")),
        expected_capacity_weighted_int=pl.when(pl.col("_should_impute"))
        .then(pl.col("_imputed_capacity_int"))
        .otherwise(pl.col("expected_capacity_weighted_int")),
        target_capacity_mean=pl.when(pl.col("_should_impute"))
        .then(pl.col("_imputed_capacity_int").cast(pl.Float64))
        .otherwise(pl.col("target_capacity_mean")),
        target_capacity_median=pl.when(pl.col("_should_impute"))
        .then(pl.col("_imputed_capacity_int"))
        .otherwise(pl.col("target_capacity_median")),
        capacity_min=pl.when(pl.col("_should_impute")).then(pl.col("_imputed_capacity_int")).otherwise(pl.col("capacity_min")),
        capacity_max=pl.when(pl.col("_should_impute")).then(pl.col("_imputed_capacity_int")).otherwise(pl.col("capacity_max")),
        capacity_mean=pl.when(pl.col("_should_impute"))
        .then(pl.col("_imputed_capacity_int").cast(pl.Float64))
        .otherwise(pl.col("capacity_mean")),
        capacity_median=pl.when(pl.col("_should_impute")).then(pl.col("_imputed_capacity_int")).otherwise(pl.col("capacity_median")),
        capacity_std=pl.when(pl.col("_should_impute")).then(pl.lit(0.0)).otherwise(pl.col("capacity_std")),
        p10_capacity=pl.when(pl.col("_should_impute"))
        .then(pl.col("_imputed_capacity_int").cast(pl.Float64))
        .otherwise(pl.col("p10_capacity")),
        p90_capacity=pl.when(pl.col("_should_impute"))
        .then(pl.col("_imputed_capacity_int").cast(pl.Float64))
        .otherwise(pl.col("p90_capacity")),
        confidence=pl.when(pl.col("_should_impute")).then(pl.lit("imputed_no_data")).otherwise(pl.col("confidence")),
        notes=pl.when(pl.col("_should_impute"))
        .then(
            pl.format(
                "IMPUTED_NO_DATA: type={}, model={}, cap={}",
                pl.col("_imputed_type"),
                pl.col("_imputed_model_label"),
                pl.col("_imputed_capacity_int"),
            )
        )
        .otherwise(pl.col("notes")),
        likely_models_topk_json=pl.when(pl.col("_should_impute"))
        .then(
            pl.format(
                '[{{"brand_model":"{}","model_capacity_int":{},"share_by_vehicles":1.0}}]',
                pl.col("_imputed_model_label"),
                pl.col("_imputed_capacity_int"),
            )
        )
        .otherwise(pl.col("likely_models_topk_json")),
    ).drop(["_imputed_model_label", "_imputed_capacity_int", "_imputed_type", "_should_impute"], strict=False)

    daily2 = daily_df
    n_daily_imputed = 0
    if not daily2.is_empty() and "expected_capacity_weighted_daily" in daily2.columns:
        daily2 = daily2.join(imputed.select(["line_code", "_imputed_capacity_int"]), on="line_code", how="left")
        mask = daily2.select(
            (
                pl.col("expected_capacity_weighted_daily").is_null()
                & pl.col("line_code").is_in(list(no_data_set))
                & pl.col("_imputed_capacity_int").is_not_null()
            ).alias("m")
        )["m"]
        n_daily_imputed = int(mask.sum())
        daily2 = (
            daily2.with_columns(
                expected_capacity_weighted_daily=pl.when(
                    pl.col("expected_capacity_weighted_daily").is_null() & pl.col("line_code").is_in(list(no_data_set))
                )
                .then(pl.col("_imputed_capacity_int").cast(pl.Float64))
                .otherwise(pl.col("expected_capacity_weighted_daily"))
            )
            .drop(["_imputed_capacity_int"], strict=False)
        )

    return rep2, daily2, n_rep_imputed, n_daily_imputed


def _read_df(path: Path, fmt: str) -> pl.DataFrame:
    if fmt == "parquet":
        return pl.read_parquet(path)
    if fmt == "csv":
        return pl.read_csv(path, infer_schema_length=10_000)
    raise ValueError(f"Unsupported format: {fmt}")


def _write_df(df: pl.DataFrame, path: Path, fmt: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if fmt == "parquet":
        df.write_parquet(path)
        return
    if fmt == "csv":
        df.write_csv(path)
        return
    raise ValueError(f"Unsupported format: {fmt}")


def parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Impute capacities for known no-data bus lines (offline patch).")
    parser.add_argument(
        "--processed-dir",
        default="data/processed/bus_capacity_snapshots",
        help="Directory containing processed outputs (default: data/processed/bus_capacity_snapshots)",
    )
    parser.add_argument(
        "--format",
        choices=["parquet", "csv"],
        default="parquet",
        help="Input/output format (default: parquet)",
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--inplace",
        action="store_true",
        help="Rewrite files in-place (default if --out-suffix is not provided).",
    )
    group.add_argument(
        "--out-suffix",
        default=None,
        help="Write outputs with suffix (e.g. _filled) instead of overwriting.",
    )
    return parser.parse_args(argv)


def main(argv: Iterable[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
    args = parse_args(argv)

    processed_dir = Path(args.processed_dir)
    rep_in = processed_dir / f"line_capacity_representative_vehicle.{args.format}"
    daily_in = processed_dir / f"line_capacity_daily.{args.format}"

    if not rep_in.exists() or not daily_in.exists():
        raise FileNotFoundError(f"Missing required inputs: {rep_in} or {daily_in}")

    rep_df = _read_df(rep_in, args.format)
    daily_df = _read_df(daily_in, args.format)

    rep2, daily2, n_rep_imputed, n_daily_imputed = _impute_no_data_lines(rep_df, daily_df)
    logger.info("Imputed representative rows: %s", n_rep_imputed)
    logger.info("Imputed daily rows: %s", n_daily_imputed)

    # Warn if any fixed no-data line is still missing expected capacity after imputation.
    missing = (
        rep2.filter(pl.col("line_code").is_in(NO_DATA_LINES))
        .filter(pl.col("expected_capacity_weighted_int").is_null())
        .select("line_code")
        .to_series()
        .to_list()
    )
    if missing:
        logger.warning("NO_DATA_LINES still missing expected_capacity_weighted_int: %s", missing)

    if args.out_suffix:
        rep_out = processed_dir / f"line_capacity_representative_vehicle{args.out_suffix}.{args.format}"
        daily_out = processed_dir / f"line_capacity_daily{args.out_suffix}.{args.format}"
    else:
        rep_out = rep_in
        daily_out = daily_in

    _write_df(rep2, rep_out, args.format)
    _write_df(daily2, daily_out, args.format)
    logger.info("Wrote: %s", rep_out)
    logger.info("Wrote: %s", daily_out)


if __name__ == "__main__":
    main()

