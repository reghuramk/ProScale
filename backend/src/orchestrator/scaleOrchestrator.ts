import { reconcileDesiredCapacity } from "../services/autoScalerService";
import { getFleetLatestCpuSummary } from "../services/cloudwatch.service";
import * as InfrastructureService from "../services/infrastructure.service";
import {
  desiredInstancesGauge,
  ec2CpuGauge,
  fleetAvgCpuGauge,
  fleetP95CpuGauge,
  runningInstancesGauge,
  tickDurationMs,
  ticksTotal,
} from "../services/metrics.service";
import { predictFromCpu } from "../services/ml.service";
import { logger } from "../utils/logger";
import { TagsType } from "../utils/types";

const TICK_MS = Number(process.env.SCALER_TICK_MS ?? "60000");
const MANAGED_TAG_KEY = process.env.MANAGED_TAG_KEY ?? "ProScale";
const MANAGED_TAG_VALUE = process.env.MANAGED_TAG_VALUE ?? "true";
const CPU_SIGNAL = (process.env.CPU_SIGNAL ?? "p95").toLowerCase(); // "avg" | "p95"

const SCALER_MODE = process.env.SCALER_MODE ?? "ml";
const CPU_SCALE_UP_THRESHOLD = Number(
  process.env.CPU_SCALE_UP_THRESHOLD ?? "70",
);
const CPU_SCALE_DOWN_THRESHOLD = Number(
  process.env.CPU_SCALE_DOWN_THRESHOLD ?? "20",
);
const MIN_INSTANCES = Number(process.env.MIN_INSTANCES ?? "1");
const MAX_INSTANCES = Number(process.env.MAX_INSTANCES ?? "3");

export function startScalingLoop(): void {
  logger.info({ SCALER_MODE, TICK_MS }, "Auto-scaler loop initialized");

  const runTick = async () => {
    const mode = SCALER_MODE === "baseline" ? "baseline" : "ml";
    const start = Date.now();
    ticksTotal.inc({ mode });

    try {
      // List all EC2 instances
      const instances = (await InfrastructureService.listInstances()) ?? [];

      const managed = instances.filter(
        (i) =>
          Array.isArray(i.tags) &&
          i.tags.some(
            (t: TagsType) =>
              t.Key === MANAGED_TAG_KEY && t.Value === MANAGED_TAG_VALUE,
          ),
      );

      if (!managed.length) {
        runningInstancesGauge.set(0);
        ec2CpuGauge.set(0);
        desiredInstancesGauge.set(MIN_INSTANCES);

        logger.warn(
          { tagKey: MANAGED_TAG_KEY, tagValue: MANAGED_TAG_VALUE },
          "No managed instances found, skipping tick",
        );
        return;
      }

      const running = managed.filter((i) => i.state === "running" && i.id);
      const stopped = managed.filter((i) => i.state === "stopped" && i.id);

      runningInstancesGauge.set(running.length);

      let cpu = 0;

      if (!running.length) {
        cpu = 0;
        ec2CpuGauge.set(cpu);

        logger.info(
          {
            cpu,
            running: running.length,
            stopped: stopped.length,
          },
          "Fleet has 0 running instances; cpu=0 used for decision",
        );
      } else {
        const runningIds = running.map((i) => i.id);

        const { fleetAvg, p95Cpu, perInstance } =
          await getFleetLatestCpuSummary(runningIds, 10, 300);

        fleetAvgCpuGauge.set(fleetAvg);
        fleetP95CpuGauge.set(p95Cpu);

        cpu = CPU_SIGNAL === "avg" ? fleetAvg : p95Cpu; // default p95
        ec2CpuGauge.set(cpu);

        logger.info(
          {
            cpuSignal: CPU_SIGNAL,
            fleetAvgCpu: fleetAvg,
            fleetCpuUsedForDecision: cpu,
            fleetP95Cpu: p95Cpu,
            perInstanceCpu: perInstance,
            running: running.length,
            runningIds,
            stopped: stopped.length,
            stoppedIds: stopped.map((i) => i.id),
          },
          "Fleet CPU computed for scaling decision",
        );
      }

      const desiredInstances = await decideDesiredInstances(cpu);
      desiredInstancesGauge.set(desiredInstances);

      await reconcileDesiredCapacity(desiredInstances);
    } catch (err) {
      logger.error({ err }, "Error in autoscaler loop tick");
    } finally {
      tickDurationMs.observe(
        { mode: SCALER_MODE === "baseline" ? "baseline" : "ml" },
        Date.now() - start,
      );
    }
  };

  void runTick();
  setInterval(() => void runTick(), TICK_MS);
}

async function decideDesiredInstances(cpu: number): Promise<number> {
  if (SCALER_MODE === "baseline") {
    let desired = MIN_INSTANCES;

    if (cpu > CPU_SCALE_UP_THRESHOLD) {
      desired = MAX_INSTANCES;
    } else if (cpu < CPU_SCALE_DOWN_THRESHOLD) {
      desired = MIN_INSTANCES;
    } else {
      desired = MIN_INSTANCES;
    }

    logger.info(
      {
        cpu,
        CPU_SCALE_DOWN_THRESHOLD,
        CPU_SCALE_UP_THRESHOLD,
        desired,
        MAX_INSTANCES,
        MIN_INSTANCES,
        mode: "baseline",
      },
      "Baseline scaling decision",
    );

    return desired;
  }

  const prediction = await predictFromCpu(cpu, 0);

  if (!prediction) {
    logger.warn({ cpu }, "ML prediction failed, falling back to MIN_INSTANCES");
    return MIN_INSTANCES;
  }

  const desired = prediction.recommended_instances;

  logger.info(
    {
      action: prediction.action,
      cpu,
      desired,
      mode: "ml",
      predictedCpu: prediction.predicted_cpu,
    },
    "ML scaling decision",
  );

  return desired;
}
