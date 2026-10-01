import { execFile } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export interface ActivityRecord {
  id: string;
  customerId: string;
  clientUserId: string;
  cognitoUserId?: string | null;
  customerName: string;
  title: string;
  type: string;
  detail: string;
  time: string;
  actor: string;
  channel?: string | null;
}

export interface OfferingRecord {
  id: string;
  customerId: string;
  clientUserId: string;
  cognitoUserId?: string | null;
  customerName: string;
  name: string;
  description: string;
  status: "Active" | "Trial" | "Paused";
  startDate: string;
  expiryDate: string;
  quantity: string;
  pricing: string;
  notes: string;
  owner: string;
}

export interface DealRecord {
  id: string;
  customerId: string;
  clientUserId: string;
  cognitoUserId?: string | null;
  customerName: string;
  sourceDealId: string;
  name: string;
  title: string;
  value: number;
  formattedValue: string;
  currency: string;
  probability: number;
  stage: string;
  status: string;
  pipelineName: string;
  owner: string;
  createdDate: string;
  lastActivityDate: string;
}

export interface TaskRecord {
  id: string;
  customerId: string;
  clientUserId: string;
  cognitoUserId?: string | null;
  customerName: string;
  sourceTaskId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
  createdBy: string;
  createdDate: string;
}

export interface TicketReplyRecord {
  id: string;
  userName: string;
  message: string;
  createdAt: string;
}

export interface TicketRecord {
  id: string;
  customerId: string;
  clientUserId: string;
  cognitoUserId?: string | null;
  customerName: string;
  sourceTicketId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdBy: string;
  createdDate: string;
  replies: TicketReplyRecord[];
}

export interface ContactGroupRecord {
  id: string;
  customerId: string;
  clientUserId: string;
  cognitoUserId?: string | null;
  customerName: string;
  sourceGroupId: string;
  name: string;
  channels?: string | null;
  totalCount: number;
  createdDate: string;
}

export interface NoteRecord {
  id: string;
  customerId: string;
  clientUserId: string;
  cognitoUserId?: string | null;
  customerName: string;
  title: string;
  content: string;
  createdBy: string;
  createdDate: string;
  updatedAt: string;
}

interface AnalyticsDbPayload {
  success: boolean;
  activities: ActivityRecord[];
  products: OfferingRecord[];
  deals: DealRecord[];
  tasks: TaskRecord[];
  tickets: TicketRecord[];
  groups: ContactGroupRecord[];
  notes: NoteRecord[];
  error?: string;
}

let cachedData: AnalyticsDbPayload | null = null;
let lastFetchTime = 0;
let inFlightPromise: Promise<AnalyticsDbPayload> | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

function getPythonPath(): string {
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    return process.env.PYTHON_PATH;
  }
  const pgAdminPython = "C:\\Users\\Dell\\AppData\\Local\\Programs\\pgAdmin 4\\python\\python.exe";
  if (fs.existsSync(pgAdminPython)) {
    return pgAdminPython;
  }
  return "python";
}

function getScriptPath(): string {
  const baseDir =
    typeof import.meta !== "undefined" && import.meta.url
      ? path.dirname(fileURLToPath(import.meta.url))
      : typeof __dirname !== "undefined"
      ? __dirname
      : process.cwd();

  const possiblePaths = [
    path.resolve(process.cwd(), "server", "queryAnalyticsDb.py"),
    path.resolve(baseDir, "queryAnalyticsDb.py"),
    path.resolve(baseDir, "..", "server", "queryAnalyticsDb.py"),
    path.resolve(baseDir, "server", "queryAnalyticsDb.py"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return path.resolve(process.cwd(), "server", "queryAnalyticsDb.py");
}

export async function fetchAnalyticsData(force = false): Promise<AnalyticsDbPayload> {
  const now = Date.now();
  if (!force && cachedData && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedData;
  }

  if (!force && inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = new Promise<AnalyticsDbPayload>((resolve) => {
    const pythonExe = getPythonPath();
    const scriptPath = getScriptPath();

    execFile(
      pythonExe,
      [scriptPath],
      { maxBuffer: 15 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          console.error("❌ [AnalyticsDb] Query execution failed:", error.message);
          if (stderr) console.error("❌ [AnalyticsDb] Stderr:", stderr);
          if (cachedData) {
            console.warn("⚠️ [AnalyticsDb] Serving stale cached data due to query error");
            return resolve(cachedData);
          }
          return resolve({
            success: false,
            activities: [],
            products: [],
            deals: [],
            tasks: [],
            tickets: [],
            groups: [],
            notes: [],
            error: error.message,
          });
        }

        try {
          const parsed = JSON.parse(stdout.trim()) as AnalyticsDbPayload;
          if (parsed && parsed.success) {
            cachedData = parsed;
            lastFetchTime = Date.now();
            return resolve(parsed);
          } else {
            console.error("❌ [AnalyticsDb] Database query error:", parsed?.error);
            if (cachedData) return resolve(cachedData);
            return resolve({
              success: false,
              activities: [],
              products: [],
              deals: [],
              tasks: [],
              tickets: [],
              groups: [],
              notes: [],
              error: parsed?.error || "Unknown query error",
            });
          }
        } catch (parseErr) {
          console.error("❌ [AnalyticsDb] JSON parse error:", parseErr, "Output was:", stdout);
          if (cachedData) return resolve(cachedData);
          return resolve({
            success: false,
            activities: [],
            products: [],
            deals: [],
            tasks: [],
            tickets: [],
            groups: [],
            notes: [],
            error: "Failed to parse database output",
          });
        }
      }
    );
  }).finally(() => {
    inFlightPromise = null;
  });

  return inFlightPromise;
}

function matchesCustomer(
  record: { customerId: string; clientUserId: string; cognitoUserId?: string | null; customerName: string },
  identifier: string
): boolean {
  if (!identifier) return false;
  const target = identifier.trim().toLowerCase();
  const cId = record.customerId ? record.customerId.toLowerCase() : "";
  const clientUid = record.clientUserId ? record.clientUserId.toLowerCase() : "";
  const cognitoUid = record.cognitoUserId ? record.cognitoUserId.toLowerCase() : "";
  const cName = record.customerName ? record.customerName.toLowerCase() : "";

  return (
    (cId !== "" && cId === target) ||
    (clientUid !== "" && clientUid === target) ||
    (cognitoUid !== "" && cognitoUid === target) ||
    (cName !== "" && cName === target)
  );
}

export async function getCustomerActivities(customerId?: string, customerName?: string): Promise<ActivityRecord[]> {
  const data = await fetchAnalyticsData();
  if (!customerId && !customerName) {
    return data.activities || [];
  }

  return (data.activities || []).filter((item) => {
    if (customerId && matchesCustomer(item, customerId)) return true;
    if (customerName && matchesCustomer(item, customerName)) return true;
    return false;
  });
}

export async function getCustomerProducts(customerId?: string, customerName?: string): Promise<OfferingRecord[]> {
  const data = await fetchAnalyticsData();
  if (!customerId && !customerName) {
    return data.products || [];
  }

  return (data.products || []).filter((item) => {
    if (customerId && matchesCustomer(item, customerId)) return true;
    if (customerName && matchesCustomer(item, customerName)) return true;
    return false;
  });
}

export async function getCustomerDeals(customerId?: string, customerName?: string): Promise<DealRecord[]> {
  const data = await fetchAnalyticsData();
  if (!customerId && !customerName) {
    return data.deals || [];
  }

  return (data.deals || []).filter((item) => {
    if (customerId && matchesCustomer(item, customerId)) return true;
    if (customerName && matchesCustomer(item, customerName)) return true;
    return false;
  });
}

export async function getCustomerTasks(customerId?: string, customerName?: string): Promise<TaskRecord[]> {
  const data = await fetchAnalyticsData();
  if (!customerId && !customerName) {
    return data.tasks || [];
  }

  return (data.tasks || []).filter((item) => {
    if (customerId && matchesCustomer(item, customerId)) return true;
    if (customerName && matchesCustomer(item, customerName)) return true;
    return false;
  });
}

export async function getCustomerTickets(customerId?: string, customerName?: string): Promise<TicketRecord[]> {
  const data = await fetchAnalyticsData();
  if (!customerId && !customerName) {
    return data.tickets || [];
  }

  return (data.tickets || []).filter((item) => {
    if (customerId && matchesCustomer(item, customerId)) return true;
    if (customerName && matchesCustomer(item, customerName)) return true;
    return false;
  });
}

export async function getCustomerContactGroups(customerId?: string, customerName?: string): Promise<ContactGroupRecord[]> {
  const data = await fetchAnalyticsData();
  if (!customerId && !customerName) {
    return data.groups || [];
  }

  return (data.groups || []).filter((item) => {
    if (customerId && matchesCustomer(item, customerId)) return true;
    if (customerName && matchesCustomer(item, customerName)) return true;
    return false;
  });
}

export async function getCustomerNotes(customerId?: string, customerName?: string): Promise<NoteRecord[]> {
  const data = await fetchAnalyticsData();
  if (!customerId && !customerName) {
    return data.notes || [];
  }

  return (data.notes || []).filter((item) => {
    if (customerId && matchesCustomer(item, customerId)) return true;
    if (customerName && matchesCustomer(item, customerName)) return true;
    return false;
  });
}

export async function getCustomerOperations(customerId?: string, customerName?: string): Promise<{
  activities: ActivityRecord[];
  products: OfferingRecord[];
  deals: DealRecord[];
  tasks: TaskRecord[];
  tickets: TicketRecord[];
  groups: ContactGroupRecord[];
  notes: NoteRecord[];
}> {
  const [activities, products, deals, tasks, tickets, groups, notes] = await Promise.all([
    getCustomerActivities(customerId, customerName),
    getCustomerProducts(customerId, customerName),
    getCustomerDeals(customerId, customerName),
    getCustomerTasks(customerId, customerName),
    getCustomerTickets(customerId, customerName),
    getCustomerContactGroups(customerId, customerName),
    getCustomerNotes(customerId, customerName),
  ]);

  return { activities, products, deals, tasks, tickets, groups, notes };
}

export function invalidateAnalyticsCache(): void {
  cachedData = null;
  lastFetchTime = 0;
}


