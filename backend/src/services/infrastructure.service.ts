import {
  DescribeInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
} from "@aws-sdk/client-ec2";

import { ec2Client } from "../config/awsClient";
import { InstanceInfoType } from "./types";

export async function listInstances() {
  const response = await ec2Client.send(new DescribeInstancesCommand({}));

  const instances: InstanceInfoType[] =
    response.Reservations?.flatMap((res) =>
      (res.Instances ?? []).map((i) => ({
        id: i.InstanceId ?? "",
        launchTime: i.LaunchTime,
        state: i.State?.Name,
        type: i.InstanceType,
      })),
    ) ?? [];

  return instances;
}

export async function startInstance(instanceId: string) {
  const command = new StartInstancesCommand({ InstanceIds: [instanceId] });
  return ec2Client.send(command);
}

export async function stopInstance(instanceId: string) {
  const command = new StopInstancesCommand({ InstanceIds: [instanceId] });
  return ec2Client.send(command);
}
