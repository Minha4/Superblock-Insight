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

  try {
    const response = await fetch(
      `/api/customer-offerings?customerId=${encodeURIComponent(customerId)}`,
      { method: "GET", headers }
    );
    if (response.ok) {
      const data = (await response.json().catch(() => null)) as OfferingsResponse | null;
      if (data?.success && Array.isArray(data.offerings)) {
        return data.offerings;
      }
    }
  } catch (err) {
    console.error("Customer offerings fetch failed:", err);
  }

  return [];
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
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("customer-offering-created", {
          detail: { customerId: input.customerId, offering: data.offering },
        })
      );
    }
    return data.offering;
  }

  throw new Error(data?.error || `Failed to create customer offering (Status ${response.status})`);
}

export async function deleteCustomerOffering(
  offeringId: string
): Promise<{ success: boolean; id: string }> {
  if (!offeringId) {
    throw new Error("Offering ID is required");
  }

  const headers = await authHeaders();
  const response = await fetch(`/api/customer-offerings/${encodeURIComponent(offeringId)}`, {
    method: "DELETE",
    headers,
  });

  const data = await response.json().catch(() => null);
  if (response.ok && data?.success) {
    return { success: true, id: offeringId };
  }

  throw new Error(data?.error || `Failed to delete customer offering (Status ${response.status})`);
}
