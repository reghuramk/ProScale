import {
  DescribeInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
} from "@aws-sdk/client-ec2";

import { ec2Client } from "../config/awsClient";
import { logger } from "../utils/logger";
import { InstanceInfoType, TagsType } from "../utils/types";

export async function listInstances() {
  try {
    logger.info("Instances are being listed");
    const response = await ec2Client.send(new DescribeInstancesCommand({}));

    const instances: InstanceInfoType[] =
      response.Reservations?.flatMap((res) =>
        (res.Instances ?? []).map((i) => ({
          id: i.InstanceId ?? "",
          launchTime: i.LaunchTime,
          state: i.State?.Name,
          tags: i.Tags?.map((t) => ({
            Key: t.Key,
            Value: t.Value,
          })) as TagsType,
          type: i.InstanceType,
        })),
      ) ?? [];

    return instances;
  } catch (error) {
    console.log("Failed to list EC2 instances", error);
    logger.error(
      {
        error,
        operation: "listInstances",
        service: "EC2",
      },
      "Failed to list EC2 instances",
    );
  }
}

export async function startInstance(instanceId: string) {
  const command = new StartInstancesCommand({ InstanceIds: [instanceId] });
  return ec2Client.send(command);
}

export async function stopInstance(instanceId: string) {
  const command = new StopInstancesCommand({ InstanceIds: [instanceId] });
  return ec2Client.send(command);
}
