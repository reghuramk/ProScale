import cors from "cors";
import express, { Request, Response } from "express";
import pinoHttp from "pino-http";

import { errorHandler, notFoundHandler } from "./middleware";
import { loggerMiddleware } from "./middleware/logger.middleware";
import { authRoutes, infrastructureRoutes } from "./routes";
import { Constants } from "./utils/constants";
import { logger } from "./utils/logger";

const { ROUTES } = Constants;

const app = express();
app.use(express.json());
app.use(cors());

app.use(pinoHttp({ logger }));
app.use(loggerMiddleware);

app.use(ROUTES.AUTH.BASE, authRoutes);
app.use(ROUTES.INFRA.BASE, infrastructureRoutes);

app.get("/home", (req: Request, res: Response) => {
  logger.info("Home route accessed! Sending welcome message...");
  res.send("Welcome");
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
