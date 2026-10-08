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

/**
 * Fetches real usage metrics from the SuperBlock backend endpoint.
 * Primary: https://gateway.superblock.chat/customeranalyticsdashaboard?action=usage-metrics
 * Fallback: Local /api/usage-metrics route for offline/local development.
 * Supports platform-wide queries (no customerId) or customer-scoped queries.
 */
export async function fetchUsageMetrics(
  customerId?: string
): Promise<PlatformUsageResponse> {
  const headers = await authHeaders();

  // 1. Direct production gateway as primary source (with timeout)
  try {
    const gatewayAction = customerId
      ? `?action=usage-metrics&customerId=${encodeURIComponent(customerId)}`
      : "?action=usage-metrics";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${PRODUCTION_GATEWAY_BASE}${gatewayAction}`, {
      method: "GET",
      headers,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (res.ok) {
      const data = (await res.json()) as PlatformUsageResponse;
      if (data && typeof data === "object") {
        return data;
      }
    }
  } catch (err) {
    console.warn("Primary gateway usage-metrics fetch notice:", err);
  }

  // 2. Safe local-development fallback if the gateway cannot be reached (with timeout)
  try {
    const queryParam = customerId ? `?customerId=${encodeURIComponent(customerId)}` : "";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`/api/usage-metrics${queryParam}`, {
      method: "GET",
      headers,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (response.ok) {
      const data = (await response.json()) as PlatformUsageResponse;
      if (data && typeof data === "object") {
        return data;
      }
    }
  } catch (err) {
    console.warn("Local usage-metrics fallback fetch notice:", err);
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

export interface BroadcastRecordItem {
  id: string;
  user_id: string;
  user_name?: string | null;
  campaign_name?: string | null;
  template_name?: string | null;
  message?: string | null;
  message_txt?: string | null;
  language?: string | null;
  media_type?: string | null;
  media_url?: string | null;
  uploaded_file_url?: string | null;
  has_flow?: boolean | null;
  status: string | null;
  total_recipients: number | null;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  completed_at?: string | null;
}

export interface BroadcastUsageResponse {
  success: boolean;
  source: "postgresql_broadcasts";
  table: "public.broadcasts";
  scope?: "platform" | "customer";
  customerId?: string;
  queriedAt?: string;
  count: number;
  totalBroadcasts: number;
  totalRecipients: number;
  metrics?: {
    totalBroadcasts: number;
    totalRecipients: number;
    avgRecipients: number | null;
    maxRecipients: number | null;
    minRecipients: number | null;
    hasFlowCount: number;
    statusBreakdown: Record<string, number>;
    mediaTypeBreakdown: Record<string, number>;
    dailyBreakdown: Array<{
      date: string;
      broadcasts: number;
      recipients: number;
    }>;
    earliestBroadcastAt: string | null;
    latestBroadcastAt: string | null;
    recentBroadcasts: BroadcastRecordItem[];
  };
  usageMetrics?: UsageMetricItem[];
  metricBreakdown?: Record<string, MetricBreakdownItem>;
  warning?: string;
  error?: string;
}

/**
 * Fetches real broadcast usage data from the SuperBlock backend endpoint.
 * Primary: https://gateway.superblock.chat/customeranalyticsdashaboard?action=broadcast-usage
 * Fallback: Local /api/broadcast-usage route for offline/local development.
 * Supports platform-wide queries or customer-scoped queries via customerId / broadcasts.user_id.
 */
export async function fetchBroadcastUsage(
  customerId?: string
): Promise<BroadcastUsageResponse> {
  const headers = await authHeaders();

  // 1. Direct production gateway as primary source (with timeout)
  try {
    const gatewayAction = customerId
      ? `?action=broadcast-usage&customerId=${encodeURIComponent(customerId)}`
      : "?action=broadcast-usage";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${PRODUCTION_GATEWAY_BASE}${gatewayAction}`, {
      method: "GET",
      headers,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (res.ok) {
      const data = (await res.json()) as BroadcastUsageResponse;
      if (data && typeof data === "object") {
        return data;
      }
    }
  } catch (err) {
    console.warn("Primary gateway broadcast-usage fetch notice:", err);
  }

  // 2. Safe local-development fallback if the gateway cannot be reached (with timeout)
  try {
    const queryParam = customerId ? `?customerId=${encodeURIComponent(customerId)}` : "";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`/api/broadcast-usage${queryParam}`, {
      method: "GET",
      headers,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (response.ok) {
      const data = (await response.json()) as BroadcastUsageResponse;
      if (data && typeof data === "object") {
        return data;
      }
    }
  } catch (err) {
    console.warn("Local broadcast-usage fallback fetch notice:", err);
  }

  // 3. Clean fallback with honest reporting
  return {
    success: false,
    source: "postgresql_broadcasts",
    table: "public.broadcasts",
    scope: customerId ? "customer" : "platform",
    customerId,
    count: 0,
    totalBroadcasts: 0,
    totalRecipients: 0,
    error: "Broadcast usage service currently unpopulated or unreachable",
  };
}

/**
 * React hook to fetch and subscribe to real broadcast usage metrics.
 */
export function useBroadcastUsage(customerId?: string) {
  const [data, setData] = useState<BroadcastUsageResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchBroadcastUsage(customerId);
      setData(res);
      if (!res.success && res.error) {
        setError(res.error);
      } else {
        setError(null);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load broadcast usage data");
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
