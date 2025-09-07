import { Request, Response } from "express";

import app from "./app";

const PORT = process.env.PORT ?? "3004";

app.get("/home", (req: Request, res: Response) => {
  res.send("Welcome home");
});

app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});
