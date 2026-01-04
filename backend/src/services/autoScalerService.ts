import { scaleActionsTotal } from "../services/metrics.service";
import { logger } from "../utils/logger";
import { InstanceInfoType, TagsType } from "../utils/types";
import * as InfrastructureService from "./infrastructure.service";

let lastScaleAt = 0;
const COOLDOWN_MS = 60_000; // 60 seconds

const DRY_RUN = process.env.DRY_RUN === "true";
console.log(DRY_RUN, "DRY_RUN");
logger.info(process.env.DRY_RUN, "DRY_RUN");

const SCALER_MODE = process.env.SCALER_MODE ?? "ml";
const mode = SCALER_MODE === "baseline" ? "baseline" : "ml";

export async function reconcileDesiredCapacity(
  desiredInstances: number,
): Promise<void> {
  try {
    console.log(desiredInstances, "Inside reconile");
    const now = Date.now();
    const sinceLast = now - lastScaleAt;

    if (sinceLast < COOLDOWN_MS) {
      logger.info(
        {
          cooldownMs: COOLDOWN_MS,
          sinceLastMs: sinceLast,
        },
        "⏳ Cooldown active, skipping scale action",
      );
      return;
    }

    const instances: InstanceInfoType[] =
      (await InfrastructureService.listInstances()) ?? [];

    const managed = instances.filter(
      (i) =>
        Array.isArray(i.tags) &&
        i.tags.some(
          (t: TagsType) => t.Key === "ProScale" && t.Value === "true",
        ),
    );

    if (!managed.length) {
      logger.warn(
        {
          sampleInstance: instances[0],
          totalInstances: instances.length,
        },
        "No managed instances found with tag ProScale=true",
      );
    }

    console.log(managed[0]?.tags, "managedinstances");
    console.log(instances, "instances");

    const running = managed.filter((i) => i.state === "running");
    const stopped = managed.filter((i) => i.state === "stopped");

    const current = running.length;

    logger.info(
      {
        currentInstances: current,
        desiredInstances,
        runningIds: running.map((i) => i.id),
        stoppedIds: stopped.map((i) => i.id),
      },
      "Reconciling EC2 capacity",
    );

    logger.info(desiredInstances, "desiredInstances");
    logger.info(current, "current");

    if (desiredInstances === current) {
      logger.info("Desired capacity already satisfied, no action");
      scaleActionsTotal.inc({ action: "noop", mode, result: "success" });
      return;
    }

    if (desiredInstances > current) {
      // SCALE UP
      const needed = desiredInstances - current;
      const toStart = stopped.slice(0, needed);

      console.log(toStart, "toStart instances");
      if (toStart.length === 0) {
        logger.warn(
          {
            current,
            desiredInstances,
          },
          "No stopped instances available to scale up",
        );
        return;
      }

      logger.info(
        {
          current,
          desired: desiredInstances,
          dryRun: DRY_RUN,
          willStart: toStart.map((i) => i.id),
        },
        DRY_RUN
          ? "(DRY-RUN) Would start EC2 instances"
          : "Scaling up EC2 instances",
      );

      if (!DRY_RUN) {
        for (const inst of toStart) {
          if (!inst.id) continue;
          try {
            await InfrastructureService.startInstance(inst.id);
            scaleActionsTotal.inc({ action: "start", mode, result: "success" });
            logger.info(
              { instanceId: inst.id },
              "Started instance as part of scale up",
            );
          } catch (error) {
            scaleActionsTotal.inc({ action: "start", mode, result: "error" });
            logger.error(error);
          }
        }
      }

      lastScaleAt = Date.now();
      return;
    }
    if (desiredInstances < current) {
      // SCALE DOWN
      const excess = current - desiredInstances;
      const toStop = running.slice(0, excess);

      logger.info(
        { dryRun: DRY_RUN, stoppingIds: toStop.map((i) => i.id) },
        "Scaling DOWN evaluation",
      );

      if (DRY_RUN) {
        logger.info(
          { instanceIds: toStop.map((i) => i.id) },
          "DRY_RUN — would STOP EC2 instances",
        );
        lastScaleAt = Date.now();
        return;
      }

      for (const inst of toStop) {
        if (!inst.id) continue;
        try {
          await InfrastructureService.stopInstance(inst.id);
          scaleActionsTotal.inc({ action: "stop", mode, result: "success" });
          logger.info(
            { instanceId: inst.id },
            "Stopped instance as part of scale down",
          );
        } catch (error) {
          scaleActionsTotal.inc({ action: "stop", mode, result: "error" });
          logger.error(error);
        }
      }

      lastScaleAt = Date.now();
    }
  } catch (err) {
    logger.error({ desiredInstances, err }, "Failed to reconcile capacity");
  }
}
