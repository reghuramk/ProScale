import { context, trace } from "@opentelemetry/api";
import { NextFunction, Request, Response } from "express";

import { logger } from "../utils/logger";

export const loggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const span = trace.getSpan(context.active());
  req.log = span
    ? logger.child({
        spanId: span.spanContext().spanId,
        traceId: span.spanContext().traceId,
      })
    : logger;
  next();
};
