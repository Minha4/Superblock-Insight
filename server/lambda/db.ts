import fs from "node:fs";
import path from "node:path";
import { Pool, type QueryResult, type QueryResultRow } from "pg";

let cachedPool: Pool | null = null;
let cachedCredentials: { username?: string; password?: string } | null = null;

const REGION = process.env.AWS_REGION || "ap-south-1";

/**
 * Safely loads environment variables from .env.local or .env into process.env
 * if they are not already populated by the runtime environment.
 */
function loadEnv(): void {
  if (process.env.SUPABASE_DB_HOST && process.env.SUPABASE_DB_PASSWORD) {
    return;
  }

  try {
    const rootDir = process.cwd();
    const candidateFiles = [
      path.resolve(rootDir, ".env.local"),
      path.resolve(rootDir, ".env"),
    ];

    for (const filePath of candidateFiles) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      }
    }
  } catch {
    // Non-blocking fallback
  }
}

// Initial load check on module import
loadEnv();

/**
 * Retrieves database credentials from Supabase environment variables,
 * AWS Secrets Manager using DB_SECRET_ARN, or local environment fallbacks.
 */
async function getDbCredentials(): Promise<{ username: string; password: string }> {
  if (cachedCredentials?.username && cachedCredentials?.password) {
    return {
      username: cachedCredentials.username,
      password: cachedCredentials.password,
    };
  }

  loadEnv();

  // 1. Supabase PostgreSQL credentials (priority for Notes & Meetings)
  if (process.env.SUPABASE_DB_HOST && process.env.SUPABASE_DB_PASSWORD) {
    cachedCredentials = {
      username: process.env.SUPABASE_DB_USER || "postgres",
      password: process.env.SUPABASE_DB_PASSWORD,
    };
    return cachedCredentials as { username: string; password: string };
  }

  const secretArn = process.env.DB_SECRET_ARN;

  if (secretArn) {
    try {
      const { SecretsManagerClient, GetSecretValueCommand } = await import(
        "@aws-sdk/client-secrets-manager"
      );
      const client = new SecretsManagerClient({ region: REGION });
      const command = new GetSecretValueCommand({ SecretId: secretArn });
      const response = await client.send(command);

      if (response.SecretString) {
        try {
          const parsed = JSON.parse(response.SecretString);
          cachedCredentials = {
            username: parsed.username || parsed.user || "superblockhq",
            password: parsed.password || "",
          };
          return {
            username: cachedCredentials.username!,
            password: cachedCredentials.password!,
          };
        } catch {
          // If secret is plain text password rather than JSON
          cachedCredentials = {
            username: process.env.DB_USER || "superblockhq",
            password: response.SecretString,
          };
          return {
            username: cachedCredentials.username!,
            password: cachedCredentials.password!,
          };
        }
      }
    } catch (err: any) {
      console.warn("Could not retrieve secret from Secrets Manager:", err?.message || err);
    }
  }

  // Local / Direct environment fallback (for SSH tunnel or local testing)
  const username =
    process.env.DB_USER || process.env.PGUSER || "superblockhq";
  let password =
    process.env.DB_PASSWORD || process.env.PGPASSWORD || "";

  if (!password) {
    try {
      const { execFileSync } = await import("child_process");

      const pgAdminPython =
        "C:\\Users\\Dell\\AppData\\Local\\Programs\\pgAdmin 4\\python\\python.exe";
      const pythonExe =
        process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)
          ? process.env.PYTHON_PATH
          : fs.existsSync(pgAdminPython)
          ? pgAdminPython
          : "python";

      const { fileURLToPath } = await import("url");
      const currentDir =
        typeof __dirname !== "undefined"
          ? __dirname
          : path.dirname(fileURLToPath(import.meta.url));

      const possibleScriptPaths = [
        path.resolve(process.cwd(), "server", "queryAnalyticsDb.py"),
        path.resolve(currentDir, "..", "queryAnalyticsDb.py"),
        path.resolve(currentDir, "queryAnalyticsDb.py"),
        path.resolve(currentDir, "..", "..", "server", "queryAnalyticsDb.py"),
        "C:\\Users\\Dell\\Superblock-Insight\\server\\queryAnalyticsDb.py",
      ];

      let scriptPath = "";
      for (const p of possibleScriptPaths) {
        if (fs.existsSync(p)) {
          scriptPath = p;
          break;
        }
      }

      if (scriptPath) {
        const pass = execFileSync(pythonExe, [scriptPath, "--get-password"], {
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();

        if (pass) {
          password = pass;
          process.env.DB_PASSWORD = pass;
        }
      }
    } catch (err) {
      console.warn("Could not retrieve local DB credentials from queryAnalyticsDb:", err);
    }
  }

  if (password) {
    cachedCredentials = { username, password };
  }
  return { username, password };
}

/**
 * Initializes and returns a singleton PostgreSQL connection pool.
 * Connects to Supabase PostgreSQL when SUPABASE_DB_HOST or SUPABASE_DB_URL is provided,
 * otherwise falls back to AWS RDS Proxy / local PostgreSQL.
 */
export async function getPool(): Promise<Pool> {
  if (cachedPool) {
    return cachedPool;
  }

  loadEnv();

  // 1. Direct connection URI support
  if (process.env.SUPABASE_DB_URL) {
    const maxPoolSize = parseInt(process.env.DB_POOL_MAX || "5", 10);
    cachedPool = new Pool({
      connectionString: process.env.SUPABASE_DB_URL,
      ssl: { rejectUnauthorized: false },
      max: maxPoolSize,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    cachedPool.on("error", (err) => {
      console.error("Unexpected error on idle PostgreSQL client pool:", err);
      cachedPool = null;
    });

    return cachedPool;
  }

  const creds = await getDbCredentials();

  // 2. Check if Supabase PostgreSQL configuration is active
  const isSupabase = Boolean(process.env.SUPABASE_DB_HOST);

  let host = isSupabase
    ? process.env.SUPABASE_DB_HOST!
    : process.env.DB_HOST || "127.0.0.1";

  let port = parseInt(
    isSupabase
      ? (process.env.SUPABASE_DB_PORT || "5432")
      : (process.env.DB_PORT || (process.env.AWS_EXECUTION_ENV ? "5432" : "5433")),
    10
  );

  const database = isSupabase
    ? (process.env.SUPABASE_DB_NAME || "postgres")
    : (process.env.DB_NAME || "superblockhq");

  let user = isSupabase
    ? (process.env.SUPABASE_DB_USER || creds.username || "postgres")
    : creds.username;

  // Supabase direct hosts (db.<ref>.supabase.co) only provide IPv6 DNS.
  // When running on IPv4 environments, seamlessly route to the IPv4 connection pooler.
  if (isSupabase && host.startsWith("db.") && host.endsWith(".supabase.co")) {
    const projectRef = host.replace(/^db\./, "").replace(/\.supabase\.co$/, "");
    host = "aws-0-ap-southeast-1.pooler.supabase.com";
    port = 6543;
    if (user === "postgres") {
      user = `postgres.${projectRef}`;
    }
  }

  const password = isSupabase
    ? (process.env.SUPABASE_DB_PASSWORD || creds.password)
    : creds.password;

  const maxPoolSize = parseInt(process.env.DB_POOL_MAX || (isSupabase ? "5" : "2"), 10);

  // SSL is required for Supabase cloud connections; rejectUnauthorized: false handles cloud certificates
  const useSsl =
    !isSupabase && process.env.DB_SSL === "false"
      ? false
      : { rejectUnauthorized: false };

  cachedPool = new Pool({
    host,
    port,
    database,
    user,
    password,
    max: maxPoolSize,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: useSsl,
  });

  cachedPool.on("error", (err) => {
    console.error("Unexpected error on idle PostgreSQL client pool:", err);
    cachedPool = null;
  });

  return cachedPool;
}

/**
 * Executes a parameterized SQL query safely against PostgreSQL.
 * Never interpolates user values directly into SQL strings.
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = await getPool();
  return pool.query<T>(text, params);
}

/**
 * Gracefully shuts down the connection pool (useful in testing or teardown).
 */
export async function closePool(): Promise<void> {
  if (cachedPool) {
    await cachedPool.end();
    cachedPool = null;
  }
}
