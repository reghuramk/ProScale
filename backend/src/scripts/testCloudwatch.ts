// src/scripts/testCloudwatch.ts
import {
  getEc2CpuHistory,
  getEc2LatestCpuAverage,
} from "../services/cloudwatch.service";
import { logger } from "../utils/logger";

const INSTANCE_ID = "i-0e18ddae6e46ed5ac";

async function main() {
  logger.info({ INSTANCE_ID }, "Testing CloudWatch CPU fetch");

  const history = await getEc2CpuHistory(INSTANCE_ID, 30, 60);
  console.log(
    {
      count: history.length,
      sample: history.slice(0, 3),
    },
    "CPU history fetched",
  );
  logger.info(
    {
      count: history.length,
      sample: history.slice(0, 3),
    },
    "CPU history fetched",
  );

  const latest = await getEc2LatestCpuAverage(INSTANCE_ID, 5, 60);
  logger.info({ latest }, "Latest CPU average");
  console.log({ latest }, "Latest CPU average");
}

void main();
