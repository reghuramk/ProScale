import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import { EC2Client } from "@aws-sdk/client-ec2";

if (!process.env.AWS_REGION) {
  console.warn("AWS_REGION not set — defaulting to eu-west-2");
}

const REGION = process.env.AWS_REGION ?? "";

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  sessionToken: process.env.AWS_SESSION_TOKEN,
};

export const ec2Client = new EC2Client({ credentials, region: REGION });
export const cloudwatchClient = new CloudWatchClient({
  credentials,
  region: REGION,
});

console.log(`AWS Clients initialized for region: ${REGION}`);
