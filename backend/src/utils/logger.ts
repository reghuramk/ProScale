import pino from "pino";

import { PinoOptionsType } from "./types";

const pinoOptions: PinoOptionsType = {
  level: process.env.LOG_LEVEL ?? "info",
};

export const logger = pino(pinoOptions);
