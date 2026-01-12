# from fastapi import FastAPI
# from pydantic import BaseModel

# app = FastAPI()

# class Metrics(BaseModel):
#     cpu_usage: float
#     request_count: int

# class PredictionResponse(BaseModel):
#     predicted_cpu: float
#     action: str
#     recommended_instances: int

# @app.post("/predict", response_model=PredictionResponse)
# async def predict(metrics: Metrics):
#     cpu = metrics.cpu_usage
#     req = metrics.request_count

#     predicted_cpu = cpu * 1.15  # dummy logic
#     action = "none"
#     recommended = 1

#     if predicted_cpu > 70:
#         action = "scale_up"
#         recommended = 2
#     elif predicted_cpu < 20:
#         action = "scale_down"
#         recommended = 0

#     return PredictionResponse(
#         predicted_cpu=predicted_cpu,
#         action=action,
#         recommended_instances=recommended,
#     )

from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import List, Optional
import json
import numpy as np
from joblib import load
import os

app = FastAPI()

MODEL_PATH = os.getenv("MODEL_PATH", "model.joblib")
SCHEMA_PATH = os.getenv("SCHEMA_PATH", "feature_schema.json")

MIN_INSTANCES = int(os.getenv("MIN_INSTANCES", "1"))
MAX_INSTANCES = int(os.getenv("MAX_INSTANCES", "3"))
CPU_SCALE_UP_THRESHOLD = float(os.getenv("CPU_SCALE_UP_THRESHOLD", "70"))
CPU_SCALE_DOWN_THRESHOLD = float(os.getenv("CPU_SCALE_DOWN_THRESHOLD", "20"))

model = None
schema = None

class PredictRequest(BaseModel):
    cpu_series: List[float] = Field(..., description="Last N CPU points (oldest -> newest), 5-min resolution")
    # optional: pass current running instances if you want smarter logic later
    running_instances: Optional[int] = None

@app.on_event("startup")
def load_artifacts():
    global model, schema
    model = load(MODEL_PATH)
    with open(SCHEMA_PATH, "r") as f:
        schema = json.load(f)
    print("✅ Loaded model + schema", schema)

def featurize_from_series(cpu_series: List[float]) -> dict:
    """
    Build features consistent with train.py.
    Note: we do minimal features: cpu, lags, rolling mean/std, slopes.
    Time cyclic features are set to 0 here unless you pass timestamps (optional enhancement).
    """
    feature_cols = schema["feature_cols"]
    lag_steps = schema["lag_steps"]
    roll_windows = schema["roll_windows"]

    if len(cpu_series) < lag_steps:
        raise ValueError(f"cpu_series must contain at least {lag_steps} values")

    s = np.array(cpu_series, dtype=float)
    current = float(s[-1])

    feats = {}
    feats["cpu"] = current

    # time features (optional) — keep 0 for now (still works fine)
    feats["hour_sin"] = 0.0
    feats["hour_cos"] = 0.0
    feats["dow_sin"] = 0.0
    feats["dow_cos"] = 0.0

    # lags: lag_1 is previous point
    for k in range(1, lag_steps + 1):
        feats[f"lag_{k}"] = float(s[-k])

    # rolling stats on previous values (exclude current)
    prev = s[:-1]
    for w in roll_windows:
        window = prev[-w:] if len(prev) >= w else prev
        feats[f"roll_mean_{w}"] = float(np.mean(window))
        feats[f"roll_std_{w}"] = float(np.std(window)) if len(window) > 1 else 0.0

    feats["slope_3"] = feats["lag_1"] - feats.get("lag_3", feats["lag_1"])
    feats["slope_6"] = feats["lag_1"] - feats.get("lag_6", feats["lag_1"])

    # ensure all columns exist
    for col in feature_cols:
        if col not in feats:
            feats[col] = 0.0

    return feats

def decide_instances(predicted_cpu: float) -> tuple[str, int]:
    """
    Simple mapping predicted_cpu -> recommended instances.
    Robust, deterministic, easy to justify in dissertation.
    """
    if predicted_cpu >= CPU_SCALE_UP_THRESHOLD:
        return ("scale_up", MAX_INSTANCES)
    if predicted_cpu <= CPU_SCALE_DOWN_THRESHOLD:
        return ("scale_down", MIN_INSTANCES)
    # middle zone: keep 2 if available, else min
    if MAX_INSTANCES >= 2:
        return ("none", 2)
    return ("none", MIN_INSTANCES)

@app.post("/predict")
def predict(req: PredictRequest):
    feats = featurize_from_series(req.cpu_series)

    X = np.array([[feats[c] for c in schema["feature_cols"]]], dtype=float)
    predicted_cpu = float(model.predict(X)[0])

    action, recommended = decide_instances(predicted_cpu)

    return {
        "predicted_cpu": predicted_cpu,
        "action": action,
        "recommended_instances": recommended,
        "horizon_minutes": 5,
    }
