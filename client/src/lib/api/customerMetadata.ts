export interface CustomerMetadataRecord {
  customer_id: string;
  company_name?: string | null;
  industry?: string | null;
  plan?: string | null;
  owner_id?: string | null;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  resolved_owner_name?: string | null;
}

export interface CustomerMetadataResponse {
  success: boolean;
  count: number;
  metadata: CustomerMetadataRecord[];
}

/**
 * Loads all customer metadata from Analytics Studio Supabase (public.customer_metadata).
 * Returns a map of customer_id -> CustomerMetadataRecord.
 */
export async function getAllCustomerMetadata(): Promise<Record<string, CustomerMetadataRecord>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("/api/customer-metadata", { signal: controller.signal }).finally(() =>
      clearTimeout(timeoutId)
    );
    if (!res.ok) return {};
    const data: CustomerMetadataResponse = await res.json();
    if (!data.success || !Array.isArray(data.metadata)) return {};

    const map: Record<string, CustomerMetadataRecord> = {};
    for (const record of data.metadata) {
      if (record.customer_id) {
        map[record.customer_id] = record;
      }
    }
    return map;
  } catch (err) {
    console.warn("Could not fetch customer metadata:", err);
    return {};
  }
}

/**
 * Loads metadata for a single customer by customer_id.
 */
export async function getCustomerMetadata(customerId: string): Promise<CustomerMetadataRecord | null> {
  if (!customerId) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`/api/customer-metadata/${encodeURIComponent(customerId)}`, {
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));
    if (!res.ok) return null;
    const data = await res.json();
    return data?.metadata || null;
  } catch (err) {
    console.warn("Could not fetch customer metadata for", customerId, err);
    return null;
  }
}

/**
 * Updates/upserts customer metadata in Supabase public.customer_metadata.
 */
export async function updateCustomerMetadata(
  customerId: string,
  updates: Partial<CustomerMetadataRecord>
): Promise<CustomerMetadataRecord> {
  const res = await fetch(`/api/customer-metadata/${encodeURIComponent(customerId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update customer metadata (${res.status})`);
  }
  const data = await res.json();
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("customer-operations-updated", {
        detail: { customerId, metadata: data.metadata },
      })
    );
  }
  return data.metadata;
}

/**
 * Batch assigns an owner to selected customer accounts in Supabase public.customer_metadata.
 */
export async function batchAssignOwner(
  customerIds: string[],
  ownerId: string
): Promise<CustomerMetadataRecord[]> {
  const res = await fetch("/api/customer-metadata/batch-owner", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerIds, ownerId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to batch assign owner (${res.status})`);
  }
  const data = await res.json();
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("customer-operations-updated", {
        detail: { customerIds, ownerId },
      })
    );
  }
  return data.metadata || [];
}

/**
 * Batch adds a tag to selected customer accounts in Supabase public.customer_metadata.
 */
export async function batchAddTag(
  customerIds: string[],
  tag: string
): Promise<CustomerMetadataRecord[]> {
  const res = await fetch("/api/customer-metadata/batch-tag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerIds, tag }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to batch add tag (${res.status})`);
  }
  const data = await res.json();
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("customer-operations-updated", {
        detail: { customerIds, tag },
      })
    );
  }
  return data.metadata || [];
}
