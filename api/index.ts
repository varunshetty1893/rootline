import type { Request, Response } from "express";
import { createExpressApp } from "../artifacts/api-server/src/rootline-server.js";
import { initDatabase, isDatabaseConnected } from "../artifacts/api-server/src/rootline/db.js";
import { store } from "../artifacts/api-server/src/rootline/store.js";

let appPromise: Promise<Awaited<ReturnType<typeof createExpressApp>>> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      try {
        const connected = await initDatabase();
        if (connected) {
          await store.initFromDatabase();
        }
      } catch (error) {
        console.error("Vercel database initialization error:", error);
      }
      return createExpressApp();
    })();
  }
  return appPromise;
}

export default async function handler(req: Request, res: Response) {
  const matchedPath = (req.headers["x-matched-path"] as string) || (req.headers["x-forwarded-uri"] as string);
  if (matchedPath && (req.url === "/api/index" || req.url.startsWith("/api/index?"))) {
    req.url = matchedPath;
  }

  if (process.env.DATABASE_URL?.trim() && !isDatabaseConnected()) {
    try {
      const connected = await initDatabase();
      if (connected && !store.isDatabaseSynced) {
        await store.initFromDatabase();
      }
    } catch {
      // Route handlers surface database-specific errors when persistence is required.
    }
  }

  const app = await getApp();
  return app(req, res);
}