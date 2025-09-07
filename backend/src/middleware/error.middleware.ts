import { ErrorRequestHandler, NextFunction, Request, Response } from "express";

import { Constants } from "../utils/constants";

const { ENVIRONMENT, MESSAGES } = Constants;

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const error = new Error(MESSAGES.ROUTE_NOT_FOUND);
  res.status(404);
  next(error);
};

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
) => {
  const statusCode: number = res.statusCode == 200 ? 500 : res.statusCode;
  const message = err.message || MESSAGES.INTERNAL_SERVER_ERROR;

  res.status(statusCode).json({
    message,
    success: false,
    ...(process.env.NODE_ENV === ENVIRONMENT.DEVELOPMENT && {
      stack: err.stack,
    }),
  });
};
