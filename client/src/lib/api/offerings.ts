import { fetchAuthSession } from "aws-amplify/auth";

export interface CustomerOfferingRecord {
  id: string;
  customer_id: string;
  product_id: string | null;
  offering_name: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  updated_at: string | null;
  name?: string;
  description?: string;
  quantity?: string;
  pricing?: string;
  owner?: string;
  notes?: string;
}

export interface ProductRecord {
  id: string;
  client_id: string;
  client_user_id: string;
  name: string | null;
  description: string | null;
  category: string | null;
  hsn: string | null;
  price: number | null;
  active: boolean | null;
  created_at: string | null;
}

interface OfferingsResponse {
  success: boolean;
  count: number;
  customerId: string;
  offerings: CustomerOfferingRecord[];
  error?: string;
}

const PRODUCTION_DASHBOARD_BASE =
  "https://gateway.superblock.chat/customeranalyticsdashaboard";

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const session = await fetchAuthSession();
    const token = session?.tokens?.accessToken?.toString() || "";

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.warn("Could not retrieve Cognito auth session for offerings:", error);
  }

  return headers;
}

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

function getLocalOfferingsKey(customerId: string): string {
  return `sb_offerings_${customerId}`;
}

export function getLocalOfferings(customerId: string): CustomerOfferingRecord[] {
  if (typeof window === "undefined" || !customerId) return [];
  try {
    const raw = localStorage.getItem(getLocalOfferingsKey(customerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalOffering(
  customerId: string,
  offering: CustomerOfferingRecord
): void {
  if (typeof window === "undefined" || !customerId) return;
  try {
    const existing = getLocalOfferings(customerId);
    const updated = [offering, ...existing.filter((o) => o.id !== offering.id)];
    localStorage.setItem(getLocalOfferingsKey(customerId), JSON.stringify(updated));
  } catch (err) {
    console.warn("Could not save offering to localStorage:", err);
  }
}

export function removeLocalOffering(customerId: string, offeringId: string): void {
  if (typeof window === "undefined" || !customerId) return;
  try {
    const existing = getLocalOfferings(customerId);
    const filtered = existing.filter((o) => o.id !== offeringId);
    localStorage.setItem(getLocalOfferingsKey(customerId), JSON.stringify(filtered));
  } catch {}
}

export async function getCustomerOfferings(
  customerId: string
): Promise<CustomerOfferingRecord[]> {
  if (!customerId) {
    throw new Error("Customer ID is required");
  }

  const headers = await authHeaders();

  let serverOfferings: CustomerOfferingRecord[] = [];

  try {
    const response = await fetch(
      `/api/customer-offerings?customerId=${encodeURIComponent(customerId)}`,
      { method: "GET", headers }
    );
    if (response.ok) {
      const data = (await response.json().catch(() => null)) as OfferingsResponse | null;
      if (data?.success && Array.isArray(data.offerings)) {
        serverOfferings = data.offerings;
      }
    }
  } catch (err) {
    console.warn("Customer offerings fetch failed:", err);
  }

  // Merge server offerings with locally persisted offerings
  const localOfferings = getLocalOfferings(customerId);
  const serverIds = new Set(serverOfferings.map((o) => o.id));
  return [...localOfferings.filter((l) => !serverIds.has(l.id)), ...serverOfferings];
}

export async function createCustomerOffering(input: {
  customerId: string;
  offeringName: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}): Promise<CustomerOfferingRecord> {
  const headers = await authHeaders();
  const url = "/api/customer-offerings";

  let createdOffering: CustomerOfferingRecord | null = null;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        customerId: input.customerId,
        offeringName: input.offeringName,
        status: input.status || "Active",
        startDate: input.startDate || new Date().toISOString(),
        endDate: input.endDate || null,
      }),
    });

    const data = await response.json().catch(() => null);
    if (response.ok && data?.success && data.offering) {
      createdOffering = data.offering;
    }
  } catch (err) {
    console.warn("POST /api/customer-offerings failed:", err);
  }

  // Fallback offering record if backend is in maintenance/offline
  const record: CustomerOfferingRecord = createdOffering || {
    id: `offering-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    customer_id: input.customerId,
    product_id: null,
    offering_name: input.offeringName,
    status: input.status || "Active",
    start_date: input.startDate || new Date().toISOString(),
    end_date: input.endDate || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Persist locally so it always survives re-fetches and page reloads
  saveLocalOffering(input.customerId, record);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("customer-offering-created", {
        detail: { customerId: input.customerId, offering: record },
      })
    );
  }

  return record;
}
