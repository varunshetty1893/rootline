import type { Request, Response } from "express";
import { createExpressApp } from "../server.js";
import { initDatabase } from "../server/db.js";
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
  const app = await getApp();
  return app(req, res);
}
