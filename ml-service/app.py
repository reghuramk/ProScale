from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Metrics(BaseModel):
    cpu_usage: float
    request_count: int

class PredictionResponse(BaseModel):
    predicted_cpu: float
    action: str
    recommended_instances: int

@app.post("/predict", response_model=PredictionResponse)
async def predict(metrics: Metrics):
    cpu = metrics.cpu_usage
    req = metrics.request_count

    predicted_cpu = cpu * 1.15  # dummy logic
    action = "none"
    recommended = 1

    if predicted_cpu > 70:
        action = "scale_up"
        recommended = 2
    elif predicted_cpu < 20:
        action = "scale_down"
        recommended = 0

    return PredictionResponse(
        predicted_cpu=predicted_cpu,
        action=action,
        recommended_instances=recommended,
    )
