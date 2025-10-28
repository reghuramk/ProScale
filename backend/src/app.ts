import cors from "cors";
import express, { Request, Response } from "express";

import { Middleware } from "./middleware";
import { authRoutes, infrastructureRoutes } from "./routes";
import { Constants } from "./utils/constants";

const { ROUTES } = Constants;

const app = express();
app.use(express.json());
app.use(cors());

app.use(ROUTES.AUTH.BASE, authRoutes);
app.use(ROUTES.INFRA.BASE, infrastructureRoutes);

app.get("/home", (req: Request, res: Response) => {
  res.send("Welcome home");
});

app.use(Middleware.notFoundHandler);
app.use(Middleware.errorHandler);

export default app;
