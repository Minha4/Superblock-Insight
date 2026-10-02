import { fetchAuthSession } from "aws-amplify/auth";
import { useState, useEffect, useCallback } from "react";

export interface UsageMetricItem {
  id: string;
  customer_id: string;
  metric_name: string;
  metric_value: number | null;
  metric_unit: string | null;
  recorded_at: string | null;
  created_at: string | null;
}

export interface MetricBreakdownItem {
  metricName: string;
  count: number;
  totalValue: number | null;
  avgValue: number | null;
  maxValue: number | null;
  unit: string | null;
  earliestRecordedAt: string | null;
  latestRecordedAt: string | null;
}

export interface PlanMessageVolumeCustomer {
  userId: string;
  userName: string | null;
  plan: string | null;
  messageVolume: number;
}

export interface PlanMetricsSummary {
  totalConfiguredMessageVolume: number | null;
  configuredCustomersCount: number;
  customers?: PlanMessageVolumeCustomer[];
  note: string;
}

export interface PlatformUsageResponse {
  success: boolean;
  scope?: "platform" | "customer";
  count: number;
  customerId?: string;
  usageMetrics: UsageMetricItem[];
  metricBreakdown?: Record<string, MetricBreakdownItem>;
  planMetrics?: PlanMetricsSummary;
  contactsSummary?: {
    totalContacts: number | null;
  };
  warning?: string;
  error?: string;
}

const PRODUCTION_GATEWAY_BASE =
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
  } catch {
    // Non-blocking: unauthenticated / local fallback
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

/**
 * Fetches real usage metrics from the SuperBlock backend endpoint.
 * Supports platform-wide queries (no customerId) or customer-scoped queries.
 */
export async function fetchUsageMetrics(
  customerId?: string
): Promise<PlatformUsageResponse> {
  const headers = await authHeaders();
  const queryParam = customerId ? `?customerId=${encodeURIComponent(customerId)}` : "";

  // 1. Try local/proxied API route first (/api/usage-metrics)
  try {
    const response = await fetch(`/api/usage-metrics${queryParam}`, {
      method: "GET",
      headers,
    });

    if (response.ok) {
      const data = (await response.json()) as PlatformUsageResponse;
      if (data && typeof data === "object") {
        return data;
      }
    }
  } catch (err) {
    console.warn("Local usage-metrics proxy fetch notice:", err);
  }

  // 2. Direct production gateway fallback if outside local development
  if (!isLocalhost()) {
    try {
      const gatewayAction = customerId
        ? `?action=usage-metrics&customerId=${encodeURIComponent(customerId)}`
        : "?action=usage-metrics";

      const res = await fetch(`${PRODUCTION_GATEWAY_BASE}${gatewayAction}`, {
        method: "GET",
        headers,
      });

      if (res.ok) {
        const data = (await res.json()) as PlatformUsageResponse;
        if (data && typeof data === "object") {
          return data;
        }
      }
    } catch (err) {
      console.warn("Direct gateway usage-metrics fetch notice:", err);
    }
  }

  // 3. Clean empty fallback with honest reporting
  return {
    success: false,
    scope: customerId ? "customer" : "platform",
    count: 0,
    customerId,
    usageMetrics: [],
    metricBreakdown: {},
    planMetrics: {
      totalConfiguredMessageVolume: null,
      configuredCustomersCount: 0,
      customers: [],
      note: "Contracted/configured plan monthly message volume allowance, not verified outbound delivery counts.",
    },
    contactsSummary: {
      totalContacts: null,
    },
    error: "Usage metrics service currently unpopulated or unreachable",
  };
}

/**
 * React hook to fetch and subscribe to real platform-wide usage metrics.
 */
export function useUsageMetrics(customerId?: string) {
  const [data, setData] = useState<PlatformUsageResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchUsageMetrics(customerId);
      setData(res);
      if (!res.success && res.error) {
        setError(res.error);
      } else {
        setError(null);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load usage data");
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    loading,
    error,
    refresh: loadData,
  };
}
