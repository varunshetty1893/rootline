import { createExpressApp } from "./rootline-server.js";
import { initDatabase } from "./rootline/db.js";
import { store } from "./rootline/store.js";
import { logger } from "./rootline/logger.js";

const rawPort = process.env.PORT;
if (!rawPort) throw new Error("PORT environment variable is required.");
const port = Number(rawPort);
if (!Number.isFinite(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

async function start() {
  const connected = await initDatabase();
  if (connected) {
    await store.initFromDatabase();
    logger.info("Rootline database loaded.");
  } else {
    logger.info("Rootline running with its persistent local store.");
  }

  const app = await createExpressApp();
  app.listen(port, "0.0.0.0", () => logger.info(`Rootline API listening on port ${port}`));
}

start().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(`Failed to start Rootline API: ${message}`);
  process.exit(1);
});