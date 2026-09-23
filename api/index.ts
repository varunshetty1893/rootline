import type { Request, Response } from "express";
import { createExpressApp } from "../server.js";
import { initDatabase, isDatabaseConnected } from "../server/db.js";
import { store } from "../server/store.js";

let appPromise: Promise<any> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      try {
        const dbConnected = await initDatabase();
        if (dbConnected) {
          await store.initFromDatabase();
        }
      } catch (err) {
        console.error("Vercel DB initialization error:", err);
      }
      return await createExpressApp();
    })();
  }
  return appPromise;
}

export default async function handler(req: Request, res: Response) {
  // Re-attempt DB connection on subsequent requests if initial cold-boot connection timed out
  if (process.env.DATABASE_URL?.trim() && !isDatabaseConnected()) {
    try {
      const dbConnected = await initDatabase();
      if (dbConnected && !store.isDatabaseSynced) {
        await store.initFromDatabase();
      }
    } catch {
      // Continue to app handler; route-level handlers will surface specific DB errors if persistence is needed
    }
  }

  const app = await getApp();
  return app(req, res);
}
