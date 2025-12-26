import pino from "pino";

import { PinoOptionsType } from "./types";

const pinoOptions: PinoOptionsType = {
  level: process.env.LOG_LEVEL ?? "info",
  transport: {
    options: {
      resourceAttributes: {
        "service.name": "pro-scale-service",
      },
    },
    target: "pino-opentelemetry-transport",
  },
};

export const logger = pino(pinoOptions);
