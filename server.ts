try {
  if (typeof (process as any).loadEnvFile === "function") {
    (process as any).loadEnvFile();
  }
} catch {
  // Ignore if .env is missing or already loaded
}

import express from "express";
import dns from "dns";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createExpressApp } from "./artifacts/api-server/src/rootline-server.js";
import { initDatabase } from "./artifacts/api-server/src/rootline/db.js";
import { store } from "./artifacts/api-server/src/rootline/store.js";
import { logger } from "./artifacts/api-server/src/rootline/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === "production";

async function startServer() {
  try {
    const dbConnected = await initDatabase();
    if (dbConnected) {
      await store.initFromDatabase();
      logger.info("Database loaded and synchronized successfully.");
    } else {
      logger.info("Operating with persistent store.");
    }
  } catch (dbErr) {
    logger.error("Failed to initialize database:", dbErr);
  }

  const app = await createExpressApp();

  if (!IS_PROD) {
    // In dev mode, mount Vite middleware to serve artifacts/rootline
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: path.resolve(__dirname, "artifacts/rootline"),
      configFile: path.resolve(__dirname, "artifacts/rootline/vite.config.ts"),
      server: {
        middlewareMode: true,
        host: "0.0.0.0",
        port: PORT,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "artifacts/rootline/dist/public");
    const fallbackDist = path.resolve(__dirname, "dist");
    const activeDist = fs.existsSync(distPath) ? distPath : fallbackDist;
    const indexPath = path.join(activeDist, "index.html");

    if (fs.existsSync(indexPath)) {
      app.use(express.static(activeDist));
      app.use((_req, res) => {
        res.sendFile(indexPath);
      });
    } else {
      app.get("/", (_req, res) => {
        res.status(200).json({
          status: "ok",
          service: "Rootline API",
          message: "Rootline backend service is running.",
        });
      });
      app.use((_req, res) => {
        res.status(404).json({ detail: "Not found" });
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Rootline running on http://0.0.0.0:${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  startServer().catch((err) => {
    logger.error("Failed to start server:", err);
    process.exit(1);
  });
}

export default startServer;
