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

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))] ?? 0;
}
