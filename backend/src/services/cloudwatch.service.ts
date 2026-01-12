import { GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";

import { cloudwatchClient } from "../config/awsClient";
import { logger } from "../utils/logger";
import { CpuDatapoint } from "../utils/types";

export async function getEc2CpuHistory(
  instanceId: string,
  minutesBack = 30,
  periodSec = 60,
): Promise<CpuDatapoint[]> {
  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - minutesBack * 60 * 1000);

    logger.info(
      {
        endTime,
        instanceId,
        periodSec,
        startTime,
      },
      "Fetching EC2 CPUUtilization from CloudWatch",
    );

    const cmd = new GetMetricStatisticsCommand({
      Dimensions: [{ Name: "InstanceId", Value: instanceId }],
      EndTime: endTime,
      MetricName: "CPUUtilization",
      Namespace: "AWS/EC2",
      Period: periodSec,
      StartTime: startTime,
      Statistics: ["Average"],
      Unit: "Percent",
    });

    const resp = await cloudwatchClient.send(cmd);

    const datapoints: CpuDatapoint[] =
      resp.Datapoints?.map((dp) => ({
        average: dp.Average ?? 0,
        timestamp: dp.Timestamp ?? new Date(),
      })) ?? [];

    datapoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    logger.info(
      {
        datapointCount: datapoints.length,
        first: datapoints[0],
        instanceId,
        last: datapoints[datapoints.length - 1],
      },
      "Fetched EC2 CPU history",
    );

    return datapoints;
  } catch (error) {
    console.error(`cloudwatch:`, error);
    logger.error(error);
    return [];
  }
}

export async function getEc2CpuHistoryRange(
  instanceId: string,
  startTime: Date,
  endTime: Date,
  periodSec = 300,
): Promise<CpuDatapoint[]> {
  const cmd = new GetMetricStatisticsCommand({
    Dimensions: [{ Name: "InstanceId", Value: instanceId }],
    EndTime: endTime,
    MetricName: "CPUUtilization",
    Namespace: "AWS/EC2",
    Period: periodSec,
    StartTime: startTime,
    Statistics: ["Average"],
    Unit: "Percent",
  });

  logger.info(
    { endTime, instanceId, periodSec, startTime },
    "📡 Fetching EC2 CPUUtilization (range)",
  );

  const resp = await cloudwatchClient.send(cmd);

  const datapoints: CpuDatapoint[] =
    resp.Datapoints?.map((dp) => ({
      average: dp.Average ?? 0,
      timestamp: dp.Timestamp ?? new Date(),
    })) ?? [];

  datapoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return datapoints;
}

export async function getEc2LatestCpuAverage(
  instanceId: string,
  minutesBack = 5,
  periodSec = 60,
): Promise<number> {
  try {
    const points = await getEc2CpuHistory(instanceId, minutesBack, periodSec);

    if (!points.length) {
      logger.warn({ instanceId }, "No CPU datapoints from CloudWatch");
      return 0;
    }

    // Option A: take the last datapoint
    const latest = points[points.length - 1]?.average ?? 0;

    // Option B (alternative): compute global average
    // const avg =
    //   points.reduce((sum, p) => sum + p.average, 0) / points.length;

    logger.info(
      {
        instanceId,
        latestCpu: latest,
        minutesBack,
        sampleCount: points.length,
      },
      "Latest EC2 CPU average computed",
    );

    return latest;
  } catch (error) {
    logger.error(error);
    return 0;
  }
}

export async function getFleetCpuSeries(
  instanceIds: string[],
  minutesBack = 60, // 12 points * 5min = 60 min
  periodSec = 300, // 5 min
  signal: "avg" | "p95" = "p95",
): Promise<number[]> {
  // fetch per-instance history
  const perInstance = await Promise.all(
    instanceIds.map(async (id) => ({
      id,
      points: await getEc2CpuHistory(id, minutesBack, periodSec),
    })),
  );

  // convert into aligned arrays (take same last K points per instance)
  const arrays = perInstance
    .map((x) => x.points.map((p) => p.average))
    .filter((arr) => arr.length > 0);

  if (!arrays.length) return [];

  // pick K = min length among instances
  const K = Math.min(...arrays.map((a) => a.length));

  const trimmed = arrays.map((a) => a.slice(a.length - K)); // last K

  // compute fleet metric per time index
  const series: number[] = [];
  for (let i = 0; i < K; i++) {
    const vals: (number | undefined)[] = trimmed
      .map((a) => a[i])
      .sort(
        (a: number | undefined, b: number | undefined) => (a ?? 0) - (b ?? 0),
      );
    if (signal === "avg") {
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
      const avg =
        vals.length > 0
          ? (vals.reduce(
              (s: number | undefined, v: number | undefined) =>
                (s ?? 0) + (v ?? 0),
              0,
            ) ?? 0) / vals.length
          : 0;
      series.push(avg);
    } else {
      // p95
      const idx = Math.floor(0.95 * (vals.length - 1));
      series.push(vals[idx] ?? 0);
    }
  }

  return series;
}

export async function getFleetLatestCpuSummary(
  instanceIds: string[],
  minutesBack = 10,
  periodSec = 300,
): Promise<{
  fleetAvg: number;
  p95Cpu: number;
  perInstance: Record<string, number>;
}> {
  const perInstance: Record<string, number> = {};

  if (!instanceIds.length) {
    return { fleetAvg: 0, p95Cpu: 0, perInstance };
  }

  const cpus = await Promise.all(
    instanceIds.map(async (id) => {
      const cpu = await getEc2LatestCpuAverage(id, minutesBack, periodSec);
      perInstance[id] = cpu;
      return cpu;
    }),
  );

  const fleetAvg = cpus.reduce((sum, v) => sum + v, 0) / cpus.length;
  const p95Cpu = percentile(cpus, 95);

  return { fleetAvg, p95Cpu, perInstance };
}

// function mean(values: number[]): number {
//   if (!values.length) return 0;
//   return values.reduce((s, v) => s + v, 0) / values.length;
// }

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))] ?? 0;
}
