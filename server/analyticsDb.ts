import { execFile } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { operationalQuery, query } from "./lambda/db";

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

function formatActivityTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  const dayMonth = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${dayMonth} · ${time}`;
}

function formatProductDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatPrice(price: number | string | null | undefined): string {
  if (price === null || price === undefined) return "0";
  const num = Number(price);
  if (isNaN(num)) return "0";
  if (Number.isInteger(num)) return num.toLocaleString("en-IN");
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatActivityType(action: string | null | undefined): string {
  if (!action) return "General";
  const cleaned = action.replace(/_/g, " ").trim();
  return cleaned
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

async function fetchDirectFromOperationalDb(): Promise<AnalyticsDbPayload | null> {
  try {
    const actSql = `
      SELECT
        ca.id::text,
        ca.customer_id::text,
        c.client_user_id,
        u.user_id::text AS cognito_user_id,
        c.customer_name,
        ca.source_activity_id,
        ca.action,
        ca.action_text,
        ca.description,
        ca.message,
        ca.status,
        ca.priority,
        ca.task_title,
        ca.user_id AS actor_user_id,
        ca.user_name AS actor_user_name,
        ca.created_at
      FROM public.customer_activities ca
      JOIN public.customers_details c ON ca.customer_id = c.id
      LEFT JOIN public.users u ON LOWER(c.client_user_id) = LOWER(u.user_name)
                               OR LOWER(c.client_user_id) = LOWER(u.email)
                               OR LOWER(c.client_user_id) = LOWER(u.user_email)
                               OR LOWER(c.client_user_id) = LOWER(u.user_id::text)
      ORDER BY ca.created_at DESC;
    `;

    const prodSql = `
      SELECT
        cp.id::text,
        cp.customer_id::text,
        c.client_user_id,
        u.user_id::text AS cognito_user_id,
        c.customer_name,
        cp.source_product_id,
        cp.name,
        cp.description,
        cp.category,
        cp.billing,
        cp.price,
        cp.stock,
        cp.active,
        cp.created_at
      FROM public.customer_products cp
      JOIN public.customers_details c ON cp.customer_id = c.id
      LEFT JOIN public.users u ON LOWER(c.client_user_id) = LOWER(u.user_name)
                               OR LOWER(c.client_user_id) = LOWER(u.email)
                               OR LOWER(c.client_user_id) = LOWER(u.user_email)
                               OR LOWER(c.client_user_id) = LOWER(u.user_id::text)
      ORDER BY cp.created_at DESC;
    `;

    const dealSql = `
      SELECT
        cd.id::text,
        cd.customer_id::text,
        c.client_user_id,
        u.user_id::text AS cognito_user_id,
        c.customer_name,
        cd.source_deal_id,
        cd.name,
        cd.title,
        cd.numeric_value,
        cd.currency,
        cd.probability,
        cd.stage,
        cd.status,
        cd.pipeline_name,
        cd.owner_name,
        cd.last_activity_at,
        cd.created_at
      FROM public.customer_deals cd
      JOIN public.customers_details c ON cd.customer_id = c.id
      LEFT JOIN public.users u ON LOWER(c.client_user_id) = LOWER(u.user_name)
                               OR LOWER(c.client_user_id) = LOWER(u.email)
                               OR LOWER(c.client_user_id) = LOWER(u.user_email)
                               OR LOWER(c.client_user_id) = LOWER(u.user_id::text)
      ORDER BY cd.created_at DESC;
    `;

    const taskSql = `
      SELECT
        ct.id::text,
        ct.customer_id::text,
        c.client_user_id,
        u.user_id::text AS cognito_user_id,
        c.customer_name,
        ct.source_task_id,
        ct.title,
        ct.description,
        ct.status,
        ct.priority,
        ct.due_date,
        ct.created_by,
        ct.created_at
      FROM public.customer_tasks ct
      JOIN public.customers_details c ON ct.customer_id = c.id
      LEFT JOIN public.users u ON LOWER(c.client_user_id) = LOWER(u.user_name)
                               OR LOWER(c.client_user_id) = LOWER(u.email)
                               OR LOWER(c.client_user_id) = LOWER(u.user_email)
                               OR LOWER(c.client_user_id) = LOWER(u.user_id::text)
      ORDER BY ct.created_at DESC;
    `;

    const repliesSql = `
      SELECT
        ticket_id,
        source_reply_id,
        user_name,
        user_email,
        message,
        created_at
      FROM public.customer_ticket_replies
      ORDER BY created_at ASC;
    `;

    const ticketSql = `
      SELECT
        tk.id::text,
        tk.customer_id::text,
        c.client_user_id,
        u.user_id::text AS cognito_user_id,
        c.customer_name,
        tk.source_ticket_id,
        tk.user_id,
        tk.user_name,
        tk.user_email,
        tk.title,
        tk.subject,
        tk.description,
        tk.category,
        tk.priority,
        tk.status,
        tk.created_at
      FROM public.customer_tickets tk
      JOIN public.customers_details c ON tk.customer_id = c.id
      LEFT JOIN public.users u ON LOWER(c.client_user_id) = LOWER(u.user_name)
                               OR LOWER(c.client_user_id) = LOWER(u.email)
                               OR LOWER(c.client_user_id) = LOWER(u.user_email)
                               OR LOWER(c.client_user_id) = LOWER(u.user_id::text)
      ORDER BY tk.created_at DESC;
    `;

    const groupSql = `
      SELECT
        cg.id::text,
        cg.customer_id::text,
        c.client_user_id,
        u.user_id::text AS cognito_user_id,
        c.customer_name,
        cg.source_group_id,
        cg.group_name,
        cg.channels,
        cg.total_count,
        cg.created_at
      FROM public.customer_contact_groups cg
      JOIN public.customers_details c ON cg.customer_id = c.id
      LEFT JOIN public.users u ON LOWER(c.client_user_id) = LOWER(u.user_name)
                               OR LOWER(c.client_user_id) = LOWER(u.email)
                               OR LOWER(c.client_user_id) = LOWER(u.user_email)
                               OR LOWER(c.client_user_id) = LOWER(u.user_id::text)
      ORDER BY cg.total_count DESC, cg.created_at DESC;
    `;

    const notesSql = `
      SELECT
        n.id::text,
        n.customer_id::text,
        c.client_user_id,
        u.user_id::text AS cognito_user_id,
        c.customer_name,
        n.title,
        n.content,
        n.created_by::text,
        n.created_at,
        n.updated_at
      FROM public.notes n
      JOIN public.customers_details c ON n.customer_id = c.id
      LEFT JOIN public.users u ON LOWER(c.client_user_id) = LOWER(u.user_name)
                               OR LOWER(c.client_user_id) = LOWER(u.email)
                               OR LOWER(c.client_user_id) = LOWER(u.user_email)
                               OR LOWER(c.client_user_id) = LOWER(u.user_id::text)
      ORDER BY n.created_at DESC;
    `;

    const executeQuery = async (text: string) => {
      try {
        return await operationalQuery(text);
      } catch {
        return await query(text);
      }
    };

    const [actRes, prodRes, dealRes, taskRes, repRes, tickRes, grpRes, notesRes] =
      await Promise.all([
        executeQuery(actSql).catch(() => ({ rows: [] })),
        executeQuery(prodSql).catch(() => ({ rows: [] })),
        executeQuery(dealSql).catch(() => ({ rows: [] })),
        executeQuery(taskSql).catch(() => ({ rows: [] })),
        executeQuery(repliesSql).catch(() => ({ rows: [] })),
        executeQuery(ticketSql).catch(() => ({ rows: [] })),
        executeQuery(groupSql).catch(() => ({ rows: [] })),
        executeQuery(notesSql).catch(() => ({ rows: [] })),
      ]);

    const repliesByTicket = new Map<string, TicketReplyRecord[]>();
    for (const r of repRes.rows as any[]) {
      const tId = r.ticket_id;
      if (!repliesByTicket.has(tId)) {
        repliesByTicket.set(tId, []);
      }
      repliesByTicket.get(tId)!.push({
        id: r.source_reply_id || r.id,
        userName: r.user_name || r.user_email || "Agent",
        message: r.message || "",
        createdAt: formatProductDate(r.created_at),
      });
    }

    const activities: ActivityRecord[] = (actRes.rows as any[]).map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      clientUserId: r.client_user_id,
      cognitoUserId: r.cognito_user_id,
      customerName: r.customer_name,
      title: r.task_title || r.action_text || "Activity",
      type: formatActivityType(r.action),
      detail: r.description || r.message || "—",
      time: formatActivityTime(r.created_at),
      actor: r.actor_user_name || r.actor_user_id || "System",
      channel: r.status || null,
    }));

    const products: OfferingRecord[] = (prodRes.rows as any[]).map((r) => {
      const status: "Active" | "Trial" | "Paused" = r.active ? "Active" : "Paused";
      let pricingStr = `₹${formatPrice(r.price)}`;
      if (r.billing) pricingStr += ` / ${r.billing}`;
      const qtyStr = r.stock !== null && r.stock !== undefined ? `${Number(r.stock)} units` : "—";
      return {
        id: r.id,
        customerId: r.customer_id,
        clientUserId: r.client_user_id,
        cognitoUserId: r.cognito_user_id,
        customerName: r.customer_name,
        name: r.name || "Unnamed Product",
        description: r.description || "—",
        status,
        startDate: formatProductDate(r.created_at),
        expiryDate: "—",
        quantity: qtyStr,
        pricing: pricingStr,
        notes: "—",
        owner: r.category || "System",
      };
    });

    const deals: DealRecord[] = (dealRes.rows as any[]).map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      clientUserId: r.client_user_id,
      cognitoUserId: r.cognito_user_id,
      customerName: r.customer_name,
      sourceDealId: r.source_deal_id,
      name: r.name || r.title || "Unnamed Deal",
      title: r.title || r.name || "Unnamed Deal",
      value: Number(r.numeric_value) || 0,
      formattedValue: formatPrice(r.numeric_value),
      currency: r.currency || "INR",
      probability: Number(r.probability) || 0,
      stage: r.stage || "Lead",
      status: r.status || "Open",
      pipelineName: r.pipeline_name || "Standard",
      owner: r.owner_name || "System",
      createdDate: formatProductDate(r.created_at),
      lastActivityDate: formatProductDate(r.last_activity_at),
    }));

    const tasks: TaskRecord[] = (taskRes.rows as any[]).map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      clientUserId: r.client_user_id,
      cognitoUserId: r.cognito_user_id,
      customerName: r.customer_name,
      sourceTaskId: r.source_task_id,
      title: r.title || "Task",
      description: r.description || "—",
      status: r.status || "To do",
      priority: (r.priority || "Medium").charAt(0).toUpperCase() + (r.priority || "Medium").slice(1),
      dueDate: r.due_date ? String(r.due_date) : "—",
      createdBy: r.created_by || "SuperBlock Admin",
      createdDate: formatProductDate(r.created_at),
    }));

    const tickets: TicketRecord[] = (tickRes.rows as any[]).map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      clientUserId: r.client_user_id,
      cognitoUserId: r.cognito_user_id,
      customerName: r.customer_name,
      sourceTicketId: r.source_ticket_id,
      title: r.title || r.subject || "Support Ticket",
      description: r.description || "—",
      category: r.category || "Support",
      priority: (r.priority || "Medium").charAt(0).toUpperCase() + (r.priority || "Medium").slice(1),
      status: r.status || "Open",
      createdBy: r.user_name || r.user_email || "Customer",
      createdDate: formatProductDate(r.created_at),
      replies: repliesByTicket.get(r.source_ticket_id) || [],
    }));

    const groups: ContactGroupRecord[] = (grpRes.rows as any[]).map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      clientUserId: r.client_user_id,
      cognitoUserId: r.cognito_user_id,
      customerName: r.customer_name,
      sourceGroupId: r.source_group_id,
      name: r.group_name,
      channels: r.channels,
      totalCount: Number(r.total_count) || 0,
      createdDate: formatProductDate(r.created_at),
    }));

    const notes: NoteRecord[] = (notesRes.rows as any[]).map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      clientUserId: r.client_user_id,
      cognitoUserId: r.cognito_user_id,
      customerName: r.customer_name,
      title: r.title || "Internal Note",
      content: r.content || "",
      createdBy: r.created_by || "SuperBlock Team",
      createdDate: formatProductDate(r.created_at),
      updatedAt: formatProductDate(r.updated_at),
    }));

    const totalRecords =
      activities.length +
      products.length +
      deals.length +
      tasks.length +
      tickets.length +
      groups.length +
      notes.length;

    if (totalRecords > 0) {
      return {
        success: true,
        activities,
        products,
        deals,
        tasks,
        tickets,
        groups,
        notes,
      };
    }

    return null;
  } catch (err: any) {
    console.warn("Direct operational database query error:", err?.message || err);
    return null;
  }
}

export async function fetchAnalyticsData(force = false): Promise<AnalyticsDbPayload> {
  const now = Date.now();
  if (!force && cachedData && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedData;
  }

  if (!force && inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    // 1. Try direct Node.js PostgreSQL operational query first
    try {
      const direct = await fetchDirectFromOperationalDb();
      if (direct && direct.success) {
        cachedData = direct;
        lastFetchTime = Date.now();
        return direct;
      }
    } catch (directErr) {
      console.warn("[AnalyticsDb] Direct DB attempt yielded:", directErr);
    }

    // 2. Fall back to Python script execution if local pgAdmin tunnel is present
    return new Promise<AnalyticsDbPayload>((resolve) => {
      const pythonExe = getPythonPath();
      const scriptPath = getScriptPath();

      if (pythonExe !== "python" && !fs.existsSync(pythonExe)) {
        return resolve({
          success: false,
          activities: [],
          products: [],
          deals: [],
          tasks: [],
          tickets: [],
          groups: [],
          notes: [],
          error: "Python runtime not configured",
        });
      }

      execFile(
        pythonExe,
        [scriptPath],
        { timeout: 2500, maxBuffer: 15 * 1024 * 1024 },
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
    });
  })().finally(() => {
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


