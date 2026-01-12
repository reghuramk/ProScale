// src/services/ml.service.ts
import axios from "axios";

import { logger } from "../utils/logger";
import { FleetFeaturesPayload, MlPredictionResponse } from "../utils/types";

const ML_BASE_URL = process.env.ML_SERVICE_URL ?? "http://ml-service:8000";

export async function predictFromCpu(
  cpuUsage: number,
  requestCount: number,
): Promise<MlPredictionResponse | null> {
  try {
    const payload = {
      cpu_usage: cpuUsage,
      request_count: requestCount,
    };

    const resp = await axios.post<MlPredictionResponse>(
      `${ML_BASE_URL}/predict`,
      payload,
      { timeout: 5000 },
    );

    logger.info(
      {
        cpuUsage,
        mlResponse: resp.data,
        requestCount,
      },
      "🤖 ML prediction received",
    );

    return resp.data;
  } catch (err) {
    logger.error({ err }, "Failed to call ML service");
    return null;
  }
}

export async function predictFromCpuSeries(
  cpuSeries: number[],
): Promise<MlPredictionResponse | null> {
  try {
    const payload = { cpu_series: cpuSeries };

    const resp = await axios.post<MlPredictionResponse>(
      `${ML_BASE_URL}/predict`,
      payload,
      { timeout: 5000 },
    );

    logger.info(
      {
        cpuSeriesLen: cpuSeries.length,
        lastCpu: cpuSeries[cpuSeries.length - 1],
        mlResponse: resp.data,
      },
      "🤖 ML prediction received (series)",
    );

    return resp.data;
  } catch (err) {
    logger.error({ err }, "❌ Failed to call ML service (series)");
    return null;
  }
}

export async function predictFromFleetFeatures(
  payload: FleetFeaturesPayload,
): Promise<MlPredictionResponse | null> {
  try {
    const resp = await axios.post<MlPredictionResponse>(
      `${ML_BASE_URL}/predict`,
      payload,
      { timeout: 5000 },
    );

    logger.info({ mlResponse: resp.data }, "🤖 ML prediction received");
    return resp.data;
  } catch (err: unknown) {
    logger.error({ err }, "❌ Failed to call ML service");
    return null;
  }
}
