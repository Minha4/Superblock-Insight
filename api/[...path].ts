import type { IncomingMessage, ServerResponse } from "http";

let cachedApp: any = null;

async function getApp() {
  if (cachedApp) return cachedApp;

  const errors: string[] = [];

  try {
    // @ts-ignore
    const mod = await import("../dist/index.js");
    if (mod && mod.app) {
      cachedApp = mod.app;
      return cachedApp;
    }
  } catch (e: any) {
    errors.push(`dist/index.js: ${e.message}`);
  }

  try {
    const mod = await import("../server/index.ts");
    if (mod && mod.app) {
      cachedApp = mod.app;
      return cachedApp;
    }
  } catch (e: any) {
    errors.push(`server/index.ts: ${e.message}`);
  }

  try {
    // @ts-ignore
    const mod = await import("../server/index.js");
    if (mod && mod.app) {
      cachedApp = mod.app;
      return cachedApp;
    }
  } catch (e: any) {
    errors.push(`server/index.js: ${e.message}`);
  }

  throw new Error(`Failed to load app from all candidate paths: ${errors.join(" | ")}`);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp();
    if (req.url && !req.url.startsWith("/api")) {
      req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
    }
    return app(req as any, res as any);
  } catch (err: any) {
    console.error("Vercel Serverless Function error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: false,
          error: err?.message || "Internal server error",
          name: err?.name,
          stack: err?.stack,
        })
      );
    }
  }
}
