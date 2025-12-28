import axios from "axios";

import { logger } from "../utils/logger";
import { PrometheusResponse } from "../utils/types";

const PROM_URL = process.env.PROM_URL ?? "http://prometheus:9090/api/v1/query";

export async function fetchCpuMetric(): Promise<number> {
  try {
    const query = `avg(rate(node_cpu_seconds_total{mode!="idle"}[1m]))`;

    const response = await axios.get<PrometheusResponse>(PROM_URL, {
      params: { query },
    });

    const result = response.data.data?.result?.[0]?.value?.[1];
    const cpu = result ? parseFloat(result) : 0;

    logger.info(`📊 Prometheus CPU metric fetched: ${cpu.toString()}`);
    return cpu;
  } catch (err) {
    logger.error("❌ Failed to fetch Prometheus metric");
    console.error(err);
    return 0;
  }
}
