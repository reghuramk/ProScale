from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Metrics(BaseModel):
    cpu_usage: float
    request_count: int

@app.post("/predict")
def predict(data: Metrics):
    # 🔥 Dummy prediction logic (replace with model later)
    predicted_cpu = data.cpu_usage * 1.15  # +15% expected next minute
    
    action = "none"
    recommended = 1

    if predicted_cpu > 70:
        action = "scale_up"
        recommended = 2
    elif predicted_cpu < 20:
        action = "scale_down"
        recommended = 0

    return {
        "predicted_cpu": predicted_cpu,
        "action": action,
        "recommended_instances": recommended
    }
