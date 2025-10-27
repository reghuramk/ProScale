import { NextFunction, Request, Response } from "express";

import * as InfrastructureService from "../services/infrastructure.service";
import { InstanceIdType, InstanceInfoType } from "../services/types";
import { Constants } from "../utils/constants";

const { MESSAGES } = Constants;

export const listInstances = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | undefined> => {
  try {
    const instances: InstanceInfoType[] =
      await InfrastructureService.listInstances();
    return res.status(200).json({
      instances: instances,
      message: MESSAGES.INSTANCE_LIST_FETCHED,
    });
  } catch (error) {
    console.error(`${MESSAGES.ERROR_LISTING_INSTANCES}:`, error);
    next(error);
  }
};

export const startInstance = async (
  req: Request<InstanceIdType>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { instanceId }: InstanceIdType = req.params;
    await InfrastructureService.startInstance(instanceId);
    res.status(200).json({ message: MESSAGES.INSTANCE_STARTED });
  } catch (error) {
    console.error(`${MESSAGES.ERROR_STARTING_INSTANCE}:`, error);
    next(error);
  }
};

export const stopInstance = async (
  req: Request<InstanceIdType>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { instanceId }: InstanceIdType = req.params;
    await InfrastructureService.stopInstance(instanceId);
    res.status(200).json({ message: MESSAGES.INSTANCE_STOPPED });
  } catch (error) {
    console.error(`${MESSAGES.ERROR_STOPPING_INSTANCE}:`, error);
    next(error);
  }
};

// eslint-disable-next-line @typescript-eslint/require-await
export async function scaleDown() {
  console.log("Placeholder: scale down logic will go here");
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function scaleUp() {
  console.log("Placeholder: scale up logic will go here");
}

export async function toggleInstanceState() {
  const instances = await InfrastructureService.listInstances();
  const target = instances[0];

  if (!target) {
    console.log("No instances found!");
    return;
  }

  console.log(`Target instance: ${target.id} (${target.state ?? ""})`);

  if (target.state === "stopped") {
    console.log("Starting instance...");
    await InfrastructureService.startInstance(target.id);
  } else if (target.state === "running") {
    console.log("Stopping instance...");
    await InfrastructureService.stopInstance(target.id);
  }
}
