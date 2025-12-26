import "./utils/otel";
import app from "./app";
import { logger } from "./utils/logger";

const PORT = process.env.PORT ?? "3004";

console.log(PORT, "port");

app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
  logger.info(`Listening on ${PORT}`);
});

logger.info("🚀 Application started");
