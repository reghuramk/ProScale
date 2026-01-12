import os
import json
import math
from datetime import datetime, timedelta, timezone

import boto3

REGION = os.getenv("AWS_REGION", "eu-west-2")
PERIOD_SEC = int(os.getenv("CW_PERIOD_SEC", "300"))     # 5-min buckets
MINUTES_BACK = int(os.getenv("HISTORY_MINUTES", "60"))  # 60 mins => 12 points if period=300

INSTANCE_IDS = os.getenv("INSTANCE_IDS", "").split()

if not INSTANCE_IDS or INSTANCE_IDS == [""]:
    raise SystemExit("Set INSTANCE_IDS env var (space-separated instance IDs).")

cw = boto3.client("cloudwatch", region_name=REGION)

def percentile(vals, p):
    vals = sorted(vals)
    if not vals:
        return 0.0
    k = (len(vals) - 1) * (p / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return float(vals[int(k)])
    return float(vals[f] + (vals[c] - vals[f]) * (k - f))

def fetch_cpu_series(instance_id):
    end = datetime.now(timezone.utc)
    start = end - timedelta(minutes=MINUTES_BACK)

    resp = cw.get_metric_statistics(
        Namespace="AWS/EC2",
        MetricName="CPUUtilization",
        Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
        StartTime=start,
        EndTime=end,
        Period=PERIOD_SEC,
        Statistics=["Average"],
        Unit="Percent",
    )

    # map timestamp -> average
    points = resp.get("Datapoints", [])
    points.sort(key=lambda x: x["Timestamp"])
    return {p["Timestamp"].isoformat(): float(p.get("Average", 0.0)) for p in points}

# 1) fetch per-instance series
per_instance = {iid: fetch_cpu_series(iid) for iid in INSTANCE_IDS}

# 2) align timestamps (common set)
all_timestamps = set()
for series in per_instance.values():
    all_timestamps |= set(series.keys())

timestamps = sorted(all_timestamps)

# 3) compute p95 across instances at each timestamp
p95_series = []
for ts in timestamps:
    values = []
    for iid in INSTANCE_IDS:
        if ts in per_instance[iid]:
            values.append(per_instance[iid][ts])
    if values:
        p95_series.append(percentile(values, 95))

print(json.dumps({
    "region": REGION,
    "period_sec": PERIOD_SEC,
    "minutes_back": MINUTES_BACK,
    "instance_ids": INSTANCE_IDS,
    "points": len(p95_series),
    "p95_series": p95_series,
    "tail": p95_series[-5:],
}, indent=2))
