import { fetchAuthSession } from "aws-amplify/auth";

export interface InvoiceRecord {
  id: string;
  customer_id: string;
  invoice_number: string;
  status: string;
  amount: number;
  currency: string;
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionRecord {
  id: string;
  customer_id: string;
  plan_id?: string;
  plan_name?: string;
  status: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  mrr?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProductRecord {
  id: string;
  name: string;
  category?: string;
  description?: string;
  is_active?: boolean;
}

interface InvoicesResponse {
  success: boolean;
  count: number;
  customerId: string;
  invoices: InvoiceRecord[];
  error?: string;
}

interface SubscriptionsResponse {
  success: boolean;
  count: number;
  customerId: string;
  subscriptions: SubscriptionRecord[];
  error?: string;
}

interface ProductsResponse {
  success: boolean;
  count: number;
  products: ProductRecord[];
  error?: string;
}

const PRODUCTION_CUSTOMER_BASE =
  "https://gateway.superblock.chat/customeranalytics";

const PRODUCTION_DASHBOARD_BASE =
  "https://gateway.superblock.chat/customeranalyticsdashaboard";

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    Boolean(import.meta.env.DEV) ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    host.startsWith("172.")
  );
}

/**
 * Returns request headers with the Cognito access token, strictly using the Access Token.
 */
async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const session = await fetchAuthSession();
    // Strictly use Cognito Access Token for dashboard API
    const token = session?.tokens?.accessToken?.toString() || "";
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.warn("Could not retrieve Cognito auth session for billing:", error);
  }

  return headers;
}

function getLocalInvoicesKey(customerId: string): string {
  return `sb_invoices_${customerId}`;
}

export function getLocalInvoices(customerId: string): InvoiceRecord[] {
  if (typeof window === "undefined" || !customerId) return [];
  try {
    const raw = localStorage.getItem(getLocalInvoicesKey(customerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalInvoice(customerId: string, invoice: InvoiceRecord): void {
  if (typeof window === "undefined" || !customerId) return;
  try {
    const existing = getLocalInvoices(customerId);
    const updated = [invoice, ...existing.filter((i) => i.id !== invoice.id)];
    localStorage.setItem(getLocalInvoicesKey(customerId), JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("customer-invoice-created", { detail: { customerId, invoice } }));
  } catch (err) {
    console.warn("Could not save invoice to localStorage:", err);
  }
}

/**
 * Fetches invoices for a customer from /api/invoices.
 */
export async function getCustomerInvoices(
  customerId: string
): Promise<InvoiceRecord[]> {
  if (!customerId) return [];

  const headers = await authHeaders();
  const encoded = encodeURIComponent(customerId);

  let serverInvoices: InvoiceRecord[] = [];

  try {
    const response = await fetch(`/api/invoices?customerId=${encoded}`, {
      method: "GET",
      headers,
    });
    if (response.ok) {
      const data = (await response.json().catch(() => null)) as InvoicesResponse | null;
      if (data?.success && Array.isArray(data.invoices)) {
        serverInvoices = data.invoices;
      }
    }
  } catch (err) {
    console.warn("Invoices fetch failed (database offline), using fallback:", err);
  }

  const local = getLocalInvoices(customerId);
  const serverIds = new Set(
    serverInvoices.flatMap((i) => [i.id, (i as any).invoice_number, (i as any).invoiceNumber].filter(Boolean))
  );
  return [
    ...local.filter((l) => !serverIds.has(l.id) && !serverIds.has((l as any).invoice_number)),
    ...serverInvoices,
  ];
}

/**
 * Fetches subscriptions for a customer from /api/subscriptions.
 */
export async function getCustomerSubscriptions(
  customerId: string
): Promise<SubscriptionRecord[]> {
  if (!customerId) return [];

  const headers = await authHeaders();
  const encoded = encodeURIComponent(customerId);

  try {
    const response = await fetch(`/api/subscriptions?customerId=${encoded}`, {
      method: "GET",
      headers,
    });
    const data = (await response.json().catch(() => null)) as SubscriptionsResponse | null;
    if (response.ok && data?.success && Array.isArray(data.subscriptions)) {
      return data.subscriptions;
    }
  } catch (err) {
    console.warn("Subscriptions fetch failed:", err);
  }

  return [];
}

/**
 * Fetches billing products catalog from /api/products.
 */
export async function getBillingProducts(): Promise<ProductRecord[]> {
  const headers = await authHeaders();

  try {
    const response = await fetch("/api/products", {
      method: "GET",
      headers,
    });
    const data = (await response.json().catch(() => null)) as ProductsResponse | null;
    if (response.ok && data?.success && Array.isArray(data.products)) {
      return data.products;
    }
  } catch (err) {
    console.warn("Billing products fetch failed:", err);
  }

  return [];
}

export async function createCustomerInvoice(input: {
  customerId: string;
  invoiceNumber?: string;
  amount: number;
  currency?: string;
  status?: string;
  issueDate?: string;
  dueDate?: string;
  description?: string;
}): Promise<InvoiceRecord> {
  if (!input.customerId) {
    throw new Error("Customer ID is required");
  }

  const headers = await authHeaders();
  const payload = {
    action: "create_invoice",
    ...input,
  };

  const fallbackRecord: InvoiceRecord = {
    id: input.invoiceNumber || `local-inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    customer_id: input.customerId,
    invoice_number: input.invoiceNumber || `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    status: input.status || "Paid",
    amount: input.amount || 0,
    currency: input.currency || "INR",
    issue_date: input.issueDate || new Date().toISOString(),
    due_date: input.dueDate || new Date(Date.now() + 14 * 86400000).toISOString(),
    paid_date: input.status === "Paid" ? new Date().toISOString() : null,
    description: input.description || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const response = await fetch("/api/invoices", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (response.ok && data?.success && data.invoice) {
      saveLocalInvoice(input.customerId, data.invoice);
      return data.invoice;
    }
  } catch (err) {
    console.warn("Create invoice failed, persisting locally:", err);
  }

  saveLocalInvoice(input.customerId, fallbackRecord);
  return fallbackRecord;
}

