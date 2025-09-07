#!/usr/bin/env bash
# Fetches Ocean Heat Content (0–2000 m) and produces data/ohc_tidy.csv
# Usage:
# bash data/fetch_data.sh # default = owid monthly
# bash data/fetch_data.sh owid
# bash data/fetch_data.sh noaa

set -euo pipefail
cd "$(dirname "$0")"

SOURCE="${1:-owid}"
OUT="ohc_tidy.csv"

echo "==> Fetching source: $SOURCE"

if [[ "$SOURCE" == "owid" ]]; then
  # Our World in Data monthly 0–2000 m series (World)
  URL="https://ourworldindata.org/grapher/monthly-ocean-heat-2000m.csv"
  TMP="owid_monthly_2000m.csv"
  curl -fsSL "$URL" -o "$TMP"
  # Columns: Entity,Code,Year,monthly-ocean-heat-2000m
  # Keep World rows; output: year,ohc_zj
  awk -F, 'NR==1{print "year,ohc_zj"; next} $1=="World"{print $3","$4}' "$TMP" > "$OUT"
  echo "Wrote $OUT (OWID monthly)."

elif [[ "$SOURCE" == "noaa" ]]; then
  # NOAA NCEI basin time series: World 0–2000 m yearly
  URL="https://www.ncei.noaa.gov/data/oceans/woa/DATA_ANALYSIS/3M_HEAT_CONTENT/DATA/basin/yearly/h22-w0-2000m.dat"
  TMP="noaa_world_0-2000m_yearly.dat"
  curl -fsSL "$URL" -o "$TMP"
  # Lines like: 1955.5 <value> ...
  # Col2 = World OHC in 10^22 J = ZJ. Round mid-year to integer year.
  awk 'BEGIN{OFS=","; print "year,ohc_zj"} /^[0-9]/{yr=int($1+0.5); print yr,$2}' "$TMP" > "$OUT"
  echo "Wrote $OUT (NOAA yearly)."

else
  echo "Unknown source: $SOURCE (use: owid | noaa)"
  exit 1
fi

echo "==> Preview:"
head -n 5 "$OUT"