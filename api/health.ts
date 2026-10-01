import type { IncomingMessage, ServerResponse } from "http";
import fs from "node:fs";
import path from "node:path";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  let rootFiles: string[] = [];
  let serverFiles: string[] = [];
  let distFiles: string[] = [];
  try {
    rootFiles = fs.readdirSync(process.cwd());
  } catch {}
  try {
    serverFiles = fs.readdirSync(path.resolve(process.cwd(), "server"));
  } catch {}
  try {
    distFiles = fs.readdirSync(path.resolve(process.cwd(), "dist"));
  } catch {}

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      status: "ok",
      scope: "standalone-health",
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
      cwd: process.cwd(),
      rootFiles,
      serverFiles,
      distFiles,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        HAS_SUPABASE_HOST: !!process.env.SUPABASE_DB_HOST,
        HAS_SUPABASE_PASS: !!process.env.SUPABASE_DB_PASSWORD,
        AWS_REGION: process.env.AWS_REGION || process.env.VITE_AWS_REGION,
      },
    })
  );
}
