import Redis from "ioredis";

import { Constants } from "./constants";

const { MESSAGES } = Constants;

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error(MESSAGES.REDIS_URL_UNDEFINED);
}
export const redis = new Redis(redisUrl);
