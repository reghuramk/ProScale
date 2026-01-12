// import { reconcileDesiredCapacity } from "../services/autoScalerService";
// import { getFleetLatestCpuSummary } from "../services/cloudwatch.service";
// import * as InfrastructureService from "../services/infrastructure.service";
// import {
//   desiredInstancesGauge,
//   ec2CpuGauge,
//   fleetAvgCpuGauge,
//   fleetP95CpuGauge,
//   runningInstancesGauge,
//   tickDurationMs,
//   ticksTotal,
// } from "../services/metrics.service";
// import { predictFromCpu } from "../services/ml.service";
// import { logger } from "../utils/logger";
// import { TagsType } from "../utils/types";

// const TICK_MS = Number(process.env.SCALER_TICK_MS ?? "60000");
// const MANAGED_TAG_KEY = process.env.MANAGED_TAG_KEY ?? "ProScale";
// const MANAGED_TAG_VALUE = process.env.MANAGED_TAG_VALUE ?? "true";
// const CPU_SIGNAL = (process.env.CPU_SIGNAL ?? "p95").toLowerCase(); // "avg" | "p95"

// const SCALER_MODE = process.env.SCALER_MODE ?? "ml";
// const CPU_SCALE_UP_THRESHOLD = Number(
//   process.env.CPU_SCALE_UP_THRESHOLD ?? "70",
// );
// const CPU_SCALE_DOWN_THRESHOLD = Number(
//   process.env.CPU_SCALE_DOWN_THRESHOLD ?? "20",
// );
// const MIN_INSTANCES = Number(process.env.MIN_INSTANCES ?? "1");
// const MAX_INSTANCES = Number(process.env.MAX_INSTANCES ?? "3");

// export function startScalingLoop(): void {
//   logger.info({ SCALER_MODE, TICK_MS }, "Auto-scaler loop initialized");

//   const runTick = async () => {
//     const mode = SCALER_MODE === "baseline" ? "baseline" : "ml";
//     const start = Date.now();
//     ticksTotal.inc({ mode });

//     try {
//       // List all EC2 instances
//       const instances = (await InfrastructureService.listInstances()) ?? [];

//       const managed = instances.filter(
//         (i) =>
//           Array.isArray(i.tags) &&
//           i.tags.some(
//             (t: TagsType) =>
//               t.Key === MANAGED_TAG_KEY && t.Value === MANAGED_TAG_VALUE,
//           ),
//       );

//       if (!managed.length) {
//         runningInstancesGauge.set(0);
//         ec2CpuGauge.set(0);
//         desiredInstancesGauge.set(MIN_INSTANCES);

//         logger.warn(
//           { tagKey: MANAGED_TAG_KEY, tagValue: MANAGED_TAG_VALUE },
//           "No managed instances found, skipping tick",
//         );
//         return;
//       }

//       const running = managed.filter((i) => i.state === "running" && i.id);
//       const stopped = managed.filter((i) => i.state === "stopped" && i.id);

//       runningInstancesGauge.set(running.length);

//       let cpu = 0;

//       if (!running.length) {
//         cpu = 0;
//         ec2CpuGauge.set(cpu);

//         logger.info(
//           {
//             cpu,
//             running: running.length,
//             stopped: stopped.length,
//           },
//           "Fleet has 0 running instances; cpu=0 used for decision",
//         );
//       } else {
//         const runningIds = running.map((i) => i.id);

//         const { fleetAvg, p95Cpu, perInstance } =
//           await getFleetLatestCpuSummary(runningIds, 10, 300);

//         fleetAvgCpuGauge.set(fleetAvg);
//         fleetP95CpuGauge.set(p95Cpu);

//         cpu = CPU_SIGNAL === "avg" ? fleetAvg : p95Cpu; // default p95
//         ec2CpuGauge.set(cpu);

//         logger.info(
//           {
//             cpuSignal: CPU_SIGNAL,
//             fleetAvgCpu: fleetAvg,
//             fleetCpuUsedForDecision: cpu,
//             fleetP95Cpu: p95Cpu,
//             perInstanceCpu: perInstance,
//             running: running.length,
//             runningIds,
//             stopped: stopped.length,
//             stoppedIds: stopped.map((i) => i.id),
//           },
//           "Fleet CPU computed for scaling decision",
//         );
//       }

//       const desiredInstances = await decideDesiredInstances(cpu);
//       desiredInstancesGauge.set(desiredInstances);

//       await reconcileDesiredCapacity(desiredInstances);
//     } catch (err) {
//       logger.error({ err }, "Error in autoscaler loop tick");
//     } finally {
//       tickDurationMs.observe(
//         { mode: SCALER_MODE === "baseline" ? "baseline" : "ml" },
//         Date.now() - start,
//       );
//     }
//   };

//   void runTick();
//   setInterval(() => void runTick(), TICK_MS);
// }

// async function decideDesiredInstances(cpu: number): Promise<number> {
//   if (SCALER_MODE === "baseline") {
//     let desired = MIN_INSTANCES;

//     if (cpu > CPU_SCALE_UP_THRESHOLD) {
//       desired = MAX_INSTANCES;
//     } else if (cpu < CPU_SCALE_DOWN_THRESHOLD) {
//       desired = MIN_INSTANCES;
//     } else {
//       desired = MIN_INSTANCES;
//     }

//     logger.info(
//       {
//         cpu,
//         CPU_SCALE_DOWN_THRESHOLD,
//         CPU_SCALE_UP_THRESHOLD,
//         desired,
//         MAX_INSTANCES,
//         MIN_INSTANCES,
//         mode: "baseline",
//       },
//       "Baseline scaling decision",
//     );

//     return desired;
//   }

//   const prediction = await predictFromCpu(cpu, 0);

//   if (!prediction) {
//     logger.warn({ cpu }, "ML prediction failed, falling back to MIN_INSTANCES");
//     return MIN_INSTANCES;
//   }

//   const desired = prediction.recommended_instances;

//   logger.info(
//     {
//       action: prediction.action,
//       cpu,
//       desired,
//       mode: "ml",
//       predictedCpu: prediction.predicted_cpu_5m,
//     },
//     "ML scaling decision",
//   );

//   return desired;
// }
// src/orchestrators/scaleOrchestrator.ts (or wherever your startScalingLoop lives)
import { reconcileDesiredCapacity } from "../services/autoScalerService";
import {
  getFleetCpuSeries,
  getFleetLatestCpuSummary,
} from "../services/cloudwatch.service";
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
import { predictFromCpuSeries } from "../services/ml.service";
import { logger } from "../utils/logger";
import { TagsType } from "../utils/types";

// ✅ 5-min period (CloudWatch)
const PERIOD_SEC = Number(process.env.CW_PERIOD_SEC ?? "300");

// ✅ How often your controller ticks (can still be 60s)
const TICK_MS = Number(process.env.SCALER_TICK_MS ?? "60000");

// ✅ Managed fleet filter
const MANAGED_TAG_KEY = process.env.MANAGED_TAG_KEY ?? "ProScale";
const MANAGED_TAG_VALUE = process.env.MANAGED_TAG_VALUE ?? "true";

// ✅ Use avg or p95 for decision signal (recommended: p95)
const CPU_SIGNAL = (process.env.CPU_SIGNAL ?? "p95").toLowerCase();

// ✅ baseline vs ml
const SCALER_MODE = (process.env.SCALER_MODE ?? "ml").toLowerCase();

// ✅ Baseline thresholds (if baseline mode OR ML fails)
const CPU_SCALE_UP_THRESHOLD = Number(
  process.env.CPU_SCALE_UP_THRESHOLD ?? "70",
);
const CPU_SCALE_DOWN_THRESHOLD = Number(
  process.env.CPU_SCALE_DOWN_THRESHOLD ?? "20",
);

// ✅ Capacity bounds
const MIN_INSTANCES = Number(process.env.MIN_INSTANCES ?? "1");
const MAX_INSTANCES = Number(process.env.MAX_INSTANCES ?? "3");

// ✅ How much history to build ML input series
// With PERIOD_SEC=300 and HISTORY_MINUTES=60 => ~12 points (perfect for LAG_STEPS=12)
const HISTORY_MINUTES = Number(process.env.FLEET_HISTORY_MINUTES ?? "60");
const MIN_POINTS_FOR_ML = Number(process.env.MIN_POINTS_FOR_ML ?? "12");

// -------------------------- Types --------------------------
type MlPrediction = null | {
  action?: string;
  predicted_cpu?: number;
  predicted_cpu_5m?: number;
  reason?: string;
  recommended_instances: number;
};

// -------------------------- Main loop --------------------------
export function startScalingLoop(): void {
  logger.info(
    {
      CPU_SIGNAL,
      HISTORY_MINUTES,
      MAX_INSTANCES,
      MIN_INSTANCES,
      MIN_POINTS_FOR_ML,
      PERIOD_SEC,
      SCALER_MODE,
      TICK_MS,
    },
    "⏱️ Auto-scaler loop initialized",
  );

  const runTick = async () => {
    const modeLabel = SCALER_MODE === "baseline" ? "baseline" : "ml";
    const start = Date.now();
    ticksTotal.inc({ mode: modeLabel });

    try {
      // 1) List instances
      const instances = (await InfrastructureService.listInstances()) ?? [];

      // 2) Filter managed fleet by tag ProScale=true
      const managed = instances.filter(
        (i) =>
          Array.isArray(i.tags) &&
          i.tags.some(
            (t: TagsType) =>
              t.Key === MANAGED_TAG_KEY && t.Value === MANAGED_TAG_VALUE,
          ),
      );

      if (!managed.length) {
        // keep metrics clean when fleet is empty
        runningInstancesGauge.set(0);
        fleetAvgCpuGauge.set(0);
        fleetP95CpuGauge.set(0);
        ec2CpuGauge.set(0);
        desiredInstancesGauge.set(MIN_INSTANCES);

        logger.warn(
          { tagKey: MANAGED_TAG_KEY, tagValue: MANAGED_TAG_VALUE },
          "⚠️ No managed instances found — skipping tick",
        );
        return;
      }

      const running = managed.filter((i) => i.state === "running" && i.id);
      const stopped = managed.filter((i) => i.state === "stopped" && i.id);

      runningInstancesGauge.set(running.length);

      if (!running.length) {
        // Nothing running => choose MIN_INSTANCES
        fleetAvgCpuGauge.set(0);
        fleetP95CpuGauge.set(0);
        ec2CpuGauge.set(0);

        const desired = MIN_INSTANCES;
        desiredInstancesGauge.set(desired);

        logger.info(
          { desired, running: 0, stopped: stopped.length },
          "ℹ️ Fleet has 0 running instances — using MIN_INSTANCES",
        );

        await reconcileDesiredCapacity(desired);
        return;
      }

      const runningIds = running.map((i) => i.id).filter(Boolean);

      // 3) Get latest fleet CPU summary (for dashboards/logging)
      const { fleetAvg, p95Cpu, perInstance } = await getFleetLatestCpuSummary(
        runningIds,
        10,
        PERIOD_SEC,
      );

      fleetAvgCpuGauge.set(fleetAvg);
      fleetP95CpuGauge.set(p95Cpu);

      // 4) Decide which signal drives scaling decisions
      const cpuUsedForDecision = CPU_SIGNAL === "avg" ? fleetAvg : p95Cpu;
      ec2CpuGauge.set(cpuUsedForDecision);

      logger.info(
        {
          cpuSignal: CPU_SIGNAL,
          cpuUsedForDecision,
          fleetAvgCpu: fleetAvg,
          fleetP95Cpu: p95Cpu,
          perInstanceCpu: perInstance,
          running: running.length,
          runningIds,
          stopped: stopped.length,
          stoppedIds: stopped.map((i) => i.id),
        },
        "📊 Fleet CPU summary computed",
      );

      // 5) ML prediction (or baseline)
      const cpuSeriesSignal = CPU_SIGNAL === "avg" ? "avg" : "p95";

      const cpuSeries = await getFleetCpuSeries(
        runningIds,
        HISTORY_MINUTES,
        PERIOD_SEC,
        cpuSeriesSignal,
      );

      const mlPrediction = await maybeCallMl(cpuSeries);

      const desiredInstances = decideDesiredInstances(
        cpuUsedForDecision,
        mlPrediction,
      );

      desiredInstancesGauge.set(desiredInstances);

      // 6) Reconcile capacity (respects DRY_RUN inside autoscaler service)
      await reconcileDesiredCapacity(desiredInstances);
    } catch (err) {
      logger.error({ err }, "💥 Error in autoscaler loop tick");
    } finally {
      const mode = SCALER_MODE === "baseline" ? "baseline" : "ml";
      tickDurationMs.observe({ mode }, Date.now() - start);
    }
  };

  void runTick();
  setInterval(() => void runTick(), TICK_MS);
}

function clamp(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function decideDesiredInstances(cpu: number, ml: MlPrediction): number {
  // Baseline mode OR ML not available => threshold policy
  if (SCALER_MODE === "baseline" || !ml) {
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
        mode: SCALER_MODE === "baseline" ? "baseline" : "fallback-baseline",
      },
      "⚖️ Baseline scaling decision",
    );

    return clamp(desired, MIN_INSTANCES, MAX_INSTANCES);
  }

  // ML mode => use recommended_instances (clamped)
  const desired = clamp(ml.recommended_instances, MIN_INSTANCES, MAX_INSTANCES);

  logger.info(
    {
      action: ml.action,
      cpu,
      desired,
      mode: "ml",
      predictedCpu5m: ml.predicted_cpu_5m ?? ml.predicted_cpu,
      reason: ml.reason,
    },
    "🧠 ML scaling decision",
  );

  return desired;
}

// -------------------------- Helpers --------------------------
async function maybeCallMl(cpuSeries: number[]): Promise<MlPrediction> {
  if (SCALER_MODE === "baseline") return null;

  if (cpuSeries.length < MIN_POINTS_FOR_ML) {
    logger.warn(
      { points: cpuSeries.length, required: MIN_POINTS_FOR_ML },
      "⚠️ Not enough history for ML — will fallback to baseline this tick",
    );
    return null;
  }

  const prediction = await predictFromCpuSeries(cpuSeries);

  if (!prediction) {
    logger.warn(
      "⚠️ ML prediction failed — will fallback to baseline this tick",
    );
    return null;
  }

  logger.info(
    {
      action: prediction.action,
      predictedCpu5m: prediction.predicted_cpu_5m,
      reason: prediction.reason,
      recommendedInstances: prediction.recommended_instances,
      seriesPoints: cpuSeries.length,
      seriesTail: cpuSeries.slice(-5),
    },
    "🧠 ML prediction received",
  );

  return prediction;
}
