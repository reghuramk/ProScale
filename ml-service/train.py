# ml-service/train.py
import os
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Tuple

import boto3
import numpy as np
import pandas as pd
from joblib import dump
from dotenv import load_dotenv
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import root_mean_squared_error

load_dotenv()

@dataclass
class Config:
    region: str = os.getenv("AWS_REGION", "eu-west-2")
    tag_key: str = os.getenv("MANAGED_TAG_KEY", "ProScale")
    tag_value: str = os.getenv("MANAGED_TAG_VALUE", "true")

    # 5-minute period + 5-minute horizon
    period_sec: int = int(os.getenv("CW_PERIOD_SEC", "300"))  # 300 = 5 min
    horizon_steps: int = int(os.getenv("HORIZON_STEPS", "1"))  # 1 step ahead = +5 minutes

    # keep <= 1440 datapoints. 3 days @ 5-min = 864 points.
    days_back: int = int(os.getenv("DAYS_BACK", "3"))

    # features
    lag_steps: int = int(os.getenv("LAG_STEPS", "12"))  # 12*5min = 60 minutes history
    roll_windows: Tuple[int, ...] = (3, 6, 12)

    model_path: str = os.getenv("MODEL_PATH", "model.joblib")
    schema_path: str = os.getenv("SCHEMA_PATH", "feature_schema.json")


def list_managed_instance_ids(ec2_client, tag_key: str, tag_value: str) -> List[str]:
    paginator = ec2_client.get_paginator("describe_instances")
    ids: List[str] = []

    filters = [
        {"Name": f"tag:{tag_key}", "Values": [tag_value]},
        {"Name": "instance-state-name", "Values": ["running", "stopped"]},
    ]

    for page in paginator.paginate(Filters=filters):
        for r in page.get("Reservations", []):
            for inst in r.get("Instances", []):
                iid = inst.get("InstanceId")
                if iid:
                    ids.append(iid)

    return sorted(list(set(ids)))


def fetch_cpu_series(cw_client, instance_id: str, period_sec: int, days_back: int) -> pd.DataFrame:
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days_back)

    resp = cw_client.get_metric_statistics(
        Namespace="AWS/EC2",
        MetricName="CPUUtilization",
        Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
        StartTime=start,
        EndTime=end,
        Period=period_sec,
        Statistics=["Average"],
        Unit="Percent",
    )

    dps = resp.get("Datapoints", [])
    rows = []
    for dp in dps:
        ts = dp.get("Timestamp")
        avg = dp.get("Average", 0.0)
        if ts is None:
            continue
        rows.append({"timestamp": ts, "cpu": float(avg)})

    df = pd.DataFrame(rows)
    if df.empty:
        return df

    df = df.sort_values("timestamp").reset_index(drop=True)
    df["instance_id"] = instance_id

    # resample to strict 5-min grid (optional but improves consistency)
    df = (
        df.set_index("timestamp")
          .resample(f"{period_sec}S")
          .mean(numeric_only=True)
          .interpolate(limit_direction="both")
          .reset_index()
    )
    df["instance_id"] = instance_id
    return df


def build_features(df: pd.DataFrame, lag_steps: int, roll_windows: Tuple[int, ...], horizon_steps: int):
    """
    df columns: timestamp, cpu, instance_id
    We predict cpu at t + horizon_steps (5 minutes ahead).
    """
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)

    # time features (cyclical)
    df["hour"] = df["timestamp"].dt.hour
    df["dow"] = df["timestamp"].dt.dayofweek

    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24.0)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24.0)
    df["dow_sin"] = np.sin(2 * np.pi * df["dow"] / 7.0)
    df["dow_cos"] = np.cos(2 * np.pi * df["dow"] / 7.0)

    # lag features per instance
    df = df.sort_values(["instance_id", "timestamp"])
    for k in range(1, lag_steps + 1):
        df[f"lag_{k}"] = df.groupby("instance_id")["cpu"].shift(k)

    # rolling stats
    for w in roll_windows:
        df[f"roll_mean_{w}"] = df.groupby("instance_id")["cpu"].shift(1).rolling(w).mean()
        df[f"roll_std_{w}"] = df.groupby("instance_id")["cpu"].shift(1).rolling(w).std()

    # slope features (simple difference)
    df["slope_3"] = df["lag_1"] - df["lag_3"]
    df["slope_6"] = df["lag_1"] - df["lag_6"]

    # target: cpu at t + horizon_steps
    df["y"] = df.groupby("instance_id")["cpu"].shift(-horizon_steps)

    # drop rows with NaNs (from lags/rolling/target)
    df = df.dropna().reset_index(drop=True)

    feature_cols = [
        "cpu",
        "hour_sin", "hour_cos", "dow_sin", "dow_cos",
        "slope_3", "slope_6",
    ]
    feature_cols += [f"lag_{k}" for k in range(1, lag_steps + 1)]
    for w in roll_windows:
        feature_cols += [f"roll_mean_{w}", f"roll_std_{w}"]

    X = df[feature_cols].astype(float)
    y = df["y"].astype(float)
    return X, y, feature_cols, df


def time_based_split(df_feat: pd.DataFrame, test_frac: float = 0.2):
    # Use last 20% of time as test (per instance pooled)
    df_feat = df_feat.sort_values("timestamp")
    cut = int(len(df_feat) * (1 - test_frac))
    train_idx = df_feat.index[:cut]
    test_idx = df_feat.index[cut:]
    return train_idx, test_idx


def main():
    cfg = Config()

    print("Config:", cfg)

    session = boto3.Session(region_name=cfg.region)
    ec2_client = session.client("ec2")
    cw_client = session.client("cloudwatch")

    # 1) list managed instance ids
    instance_ids = list_managed_instance_ids(ec2_client, cfg.tag_key, cfg.tag_value)
    if not instance_ids:
        raise RuntimeError(f"No instances found with tag {cfg.tag_key}={cfg.tag_value}")

    print("Managed instances:", instance_ids)

    # 2) fetch cpu series for each instance
    all_df = []
    for iid in instance_ids:
        df_i = fetch_cpu_series(cw_client, iid, cfg.period_sec, cfg.days_back)
        if df_i.empty:
            print("No datapoints for", iid)
            continue
        all_df.append(df_i)

    if not all_df:
        raise RuntimeError("No CPU data fetched from CloudWatch for any instance")

    df = pd.concat(all_df, ignore_index=True)
    df = df.sort_values(["instance_id", "timestamp"]).reset_index(drop=True)

    # 3) build features
    X, y, feature_cols, df_feat = build_features(
        df=df,
        lag_steps=cfg.lag_steps,
        roll_windows=cfg.roll_windows,
        horizon_steps=cfg.horizon_steps,
    )

    # 4) time-based split
    train_idx, test_idx = time_based_split(df_feat, test_frac=0.2)
    X_train, y_train = X.loc[train_idx], y.loc[train_idx]
    X_test, y_test = X.loc[test_idx], y.loc[test_idx]

    print("Train size:", len(X_train), "Test size:", len(X_test))

    # 5) train model (strong baseline)
    model = HistGradientBoostingRegressor(
        max_depth=6,
        learning_rate=0.05,
        max_iter=500,
        random_state=42,
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    rmse = root_mean_squared_error(y_test, preds)  # ✅ correct RMSE usage
    mae = np.mean(np.abs(y_test - preds))

    print(f"RMSE: {rmse:.3f}  MAE: {mae:.3f}")

    # 6) export artifacts
    dump(model, cfg.model_path)
    schema = {
        "feature_cols": feature_cols,
        "period_sec": cfg.period_sec,
        "horizon_steps": cfg.horizon_steps,
        "lag_steps": cfg.lag_steps,
        "roll_windows": list(cfg.roll_windows),
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "rmse": float(rmse),
        "mae": float(mae),
    }
    with open(cfg.schema_path, "w") as f:
        json.dump(schema, f, indent=2)

    print("Saved model:", cfg.model_path)
    print("Saved schema:", cfg.schema_path)


if __name__ == "__main__":
    main()
