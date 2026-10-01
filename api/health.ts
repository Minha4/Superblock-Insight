import type { IncomingMessage, ServerResponse } from "http";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      status: "ok",
      scope: "standalone-health",
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
      env: {
        NODE_ENV: process.env.NODE_ENV,
        HAS_SUPABASE_HOST: !!process.env.SUPABASE_DB_HOST,
        HAS_SUPABASE_PASS: !!process.env.SUPABASE_DB_PASSWORD,
        AWS_REGION: process.env.AWS_REGION || process.env.VITE_AWS_REGION,
      },
    })
  );
}
