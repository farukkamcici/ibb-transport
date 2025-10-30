import polars as pl
from pathlib import Path

files = sorted(Path("../../data/raw").glob("*.csv"))

df  = pl.concat([pl.scan_csv(f) for f in files])

#hourly line data
# agg = (df
#        .select([
#             'transition_date', 'transition_hour', 'number_of_passage', 'line_name'
#         ])
#         .group_by(['transition_date', 'transition_hour', 'line_name'])
#         .agg(pl.sum('number_of_passage').alias('passage_sum')))
#
# agg.collect(engine="streaming").write_parquet("../../data/processed/transport_hourly.parquet")

#hourly district data
district_agg = (df
       .select([
            'transition_date', 'transition_hour', 'number_of_passage', 'town'
        ])
        .group_by(['transition_date', 'transition_hour', 'town'])
        .agg(pl.sum('number_of_passage').alias('passage_sum')))

district_agg.collect(engine="streaming").write_parquet("../../data/processed/transport_district_hourly.parquet")

