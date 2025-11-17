import pandas as pd
import numpy as np
import polars as pl
from pathlib import Path
import datetime

# =============================================================================
# GENEL LOG FONKSİYONU
# =============================================================================
def get_logger(log_path: Path):
    """Hem terminale hem dosyaya loglayan fonksiyon üretir."""
    def log(msg):
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{timestamp}] {msg}"
        print(line)
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    return log


# =============================================================================
# 1️⃣ PANDAS DATA QUALITY CHECK
# =============================================================================
pd_input = Path("../../data/processed/features_pd.parquet")
pd_log_path = Path("../../docs/data_quality_log.txt")
log = get_logger(pd_log_path)

log(f"📘 Pandas veri dosyası yükleniyor: {pd_input}")
df = pd.read_parquet(pd_input)
log(f"Yüklendi ✅ {df.shape[0]} satır × {df.shape[1]} sütun")

# --- Sütun Tipleri ---
log("\n=== SÜTUN TİPLERİ ===")
log(str(df.dtypes))

# --- Eksik Değer Analizi ---
log("\n=== EKSİK DEĞER ANALİZİ ===")
null_summary = df.isnull().sum().sort_values(ascending=False)
total_rows = len(df)
missing_cols = null_summary[null_summary > 0]
if missing_cols.empty:
    log("Eksik değer bulunmadı ✅")
else:
    for col, missing in missing_cols.items():
        ratio = missing / total_rows * 100
        log(f"{col}: {missing} eksik değer (%{ratio:.2f})")

# --- Sayısal Kolon Özetleri ---
log("\n=== SAYISAL KOLON ÖZETİ ===")
num_df = df.select_dtypes(include=[np.number])
if not num_df.empty:
    stats = num_df.describe().T
    log(str(stats[["min", "max", "mean", "std"]].round(3)))
else:
    log("Sayısal kolon bulunamadı.")

# --- Mantıksız Değer Kontrolü ---
log("\n=== MANTIK DIŞI DEĞERLER ===")
if "y" in df.columns:
    neg_y = df[df["y"] < 0]
    log("UYARI ⚠️: 'y' sütununda negatif değer var!") if len(neg_y) > 0 else log("'y' sütununda negatif değer yok ✅")

if "temperature_2m" in df.columns:
    tmin, tmax = df["temperature_2m"].min(), df["temperature_2m"].max()
    if tmin < -40 or tmax > 60:
        log(f"UYARI ⚠️: Sıcaklık uç değerlerde ({tmin} → {tmax})")
    else:
        log("Sıcaklık değerleri mantıklı aralıkta ✅")

if "wind_speed_10m" in df.columns:
    wmax = df["wind_speed_10m"].max()
    if wmax > 200:
        log(f"UYARI ⚠️: Rüzgar hızı aşırı yüksek (max={wmax})")
    else:
        log("Rüzgar hızı mantıklı aralıkta ✅")

# --- Benzersiz Değer Sayıları ---
log("\n=== BENZERSİZ DEĞER SAYILARI ===")
for col in df.columns:
    log(f"{col}: {df[col].nunique(dropna=True)} benzersiz değer")

log("\n✅ Pandas veri kalite taraması tamamlandı.")
log(f"Kaynak: {pd_input.name}")
log(f"Log dosyası: {pd_log_path.absolute()}")


# =============================================================================
# 2️⃣ POLARS DATA QUALITY CHECK
# =============================================================================
# pl_input = Path("../../data/processed/features_pl.parquet")
# pl_log_path = Path("../../docs/data_quality_log_pl.txt")
# log = get_logger(pl_log_path)
#
# log(f"📗 Polars veri dosyası yükleniyor: {pl_input}")
# df = pl.read_parquet(pl_input)
# log(f"Yüklendi ✅ {df.height} satır × {df.width} sütun")
#
# # --- Sütun Tipleri ---
# log("\n=== SÜTUN TİPLERİ ===")
# for col, dtype in df.schema.items():
#     log(f"{col}: {dtype}")
#
# # -----------------------------
# # 2️⃣ Eksik Değer (Null) Analizi
# # -----------------------------
# log("\n=== EKSİK DEĞER ANALİZİ ===")
# null_counts = df.null_count().to_dict(as_series=False)
# total_rows = df.height
# missing_any = False
#
# for col, count_list in null_counts.items():  # << değişiklik
#     count = count_list[0]                    # << değişiklik
#     if count > 0:
#         ratio = count / total_rows * 100
#         log(f"{col}: {count} eksik değer (%{ratio:.2f})")
#         missing_any = True
#
# if not missing_any:
#     log("Eksik değer bulunmadı ✅")
#
#
# # --- Sayısal Kolon Özetleri ---
# log("\n=== SAYISAL KOLON ÖZETİ ===")
# numeric_cols = [c for c, t in df.schema.items() if t in pl.NUMERIC_DTYPES]
# if numeric_cols:
#     stats = df.select(
#         [pl.col(c).min().alias(f"{c}_min") for c in numeric_cols] +
#         [pl.col(c).max().alias(f"{c}_max") for c in numeric_cols] +
#         [pl.col(c).mean().alias(f"{c}_mean") for c in numeric_cols] +
#         [pl.col(c).std().alias(f"{c}_std") for c in numeric_cols]
#     )
#     log(str(stats))
# else:
#     log("Sayısal kolon bulunamadı.")
#
# # --- Mantıksız Değer Kontrolü ---
# log("\n=== MANTIK DIŞI DEĞERLER ===")
# if "y" in df.columns:
#     neg_y = df.filter(pl.col("y") < 0)
#     log("UYARI ⚠️: 'y' sütununda negatif değer var!") if neg_y.height > 0 else log("'y' sütununda negatif değer yok ✅")
#
# if "temperature_2m" in df.columns:
#     tmin, tmax = (
#         df.select([
#             pl.min("temperature_2m").alias("temp_min"),
#             pl.max("temperature_2m").alias("temp_max")
#         ])
#         .row(0)
#     )
#
#     if tmin < -40 or tmax > 60:
#         log(f"UYARI ⚠️: Sıcaklık uç değerlerde ({tmin} → {tmax})")
#     else:
#         log("Sıcaklık değerleri mantıklı aralıkta ✅")
#
# if "wind_speed_10m" in df.columns:
#     wmax = df.select(pl.max("wind_speed_10m").alias("wind_max")).item()
#     if wmax > 200:
#         log(f"UYARI ⚠️: Rüzgar hızı aşırı yüksek (max={wmax})")
#     else:
#         log("Rüzgar hızı mantıklı aralıkta ✅")
#
# # --- Benzersiz Değer Sayıları ---
# log("\n=== BENZERSİZ DEĞER SAYILARI ===")
# for col in df.columns:
#     unique_count = df.select(pl.col(col).n_unique()).item()
#     log(f"{col}: {unique_count} benzersiz değer")
#
# log("\n✅ Polars veri kalite taraması tamamlandı.")
# log(f"Kaynak: {pl_input.name}")
# log(f"Log dosyası: {pl_log_path.absolute()}")
