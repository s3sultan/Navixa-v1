#!/usr/bin/env bash
set -u

url="${1:-https://navixa-staging.s2shug.workers.dev/}"
duration_seconds="${2:-1800}"
interval_seconds="${3:-1}"
out="${4:-/home/ubuntu/Navixa-v1/staging-soak-results.csv}"

printf 'timestamp,http_code,time_total,time_starttransfer\n' > "$out"
start=$(date +%s)
end=$((start + duration_seconds))

while [ "$(date +%s)" -lt "$end" ]; do
  timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  line=$(curl -sS --connect-timeout 5 --max-time 15 -o /dev/null \
    -w "%{http_code},%{time_total},%{time_starttransfer}" "$url" 2>/dev/null || printf '000,15.000,15.000')
  printf '%s,%s\n' "$timestamp" "$line" >> "$out"
  sleep "$interval_seconds"
done

awk -F, '
  NR > 1 { total++; code=$2; if (code ~ /^2/) ok++; if (code == "429") rate++; if (code ~ /^5/) e5++; if (code == "000") timeout++; sum+=$3; times[++n]=$3 }
  END {
    for (i=1; i<=n; i++) for (j=i+1; j<=n; j++) if (times[j] < times[i]) { t=times[i]; times[i]=times[j]; times[j]=t }
    p=0; if (n>0) { idx=int(n*0.95); if (idx<1) idx=1; p=times[idx] }
    printf "requests=%d success_2xx=%d status_429=%d server_5xx=%d timeouts=%d average_total_seconds=%.3f p95_total_seconds=%.3f\n", total, ok, rate, e5, timeout, (total ? sum/total : 0), p
  }
' "$out"
