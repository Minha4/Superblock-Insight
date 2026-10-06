import { operationalQuery, query } from "../db";
import type { QueryResult, QueryResultRow } from "pg";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  BroadcastRecord,
  BroadcastStatusCount,
  BroadcastMediaTypeCount,
  BroadcastDailyCount,
  BroadcastUsageMetrics,
  GetBroadcastUsageResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

/**
 * Safely executes a read-only query against the SuperBlock operational database ('superblockhq').
 * Falls back to the primary query pool if operational pool is not configured or in local dev.
 */
async function executeBroadcastQuery<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  try {
    return await operationalQuery<T>(text, params);
  } catch (opErr: any) {
    // If operational query pool is unreachable (e.g. local environment without tunnel),
    // attempt standard query pool in case public.broadcasts is available there
    try {
      return await query<T>(text, params);
    } catch {
      // Re-throw original operational database error for accurate diagnostics
      throw opErr;
    }
  }
}

/**
 * Real Broadcast usage Lambda handler using the PostgreSQL operational database ('superblockhq').
 *
 * Source table: public.broadcasts
 * Confirmed columns: id, user_id, campaign_name, template_name, message, message_txt,
 * language, media_url, uploaded_file_url, media_handle, media_type, has_flow,
 * business_phone_number_id, graph_api_token, status, total_recipients,
 * scheduled_at, sent_at, user_name, created_at, completed_at, updated_at, payload.
 *
 * SECURITY: graph_api_token is strictly excluded from all queries.
 * SAFETY: READ-ONLY. No INSERT, UPDATE, DELETE, or DDL statements.
 *
 * Requirements:
 * - Accept customer identifier and filter on public.broadcasts.user_id (with user_name support).
 * - Return real broadcast count, total_recipients, status breakdown, and media type breakdown.
 * - Compatible with Customer 360 usage consumption (metricBreakdown.broadcasts.totalValue).
 */
export async function getBroadcastUsageHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const queriedAt = new Date().toISOString();

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: "OK" }),
    };
  }

  let customerId = "";
  let limit = 50;

  try {
    const params = event.queryStringParameters || {};
    const pathParams = event.pathParameters || {};

    // 1. Resolve customer identifier
    customerId = (
      params.customerId ||
      params.customer_id ||
      params.userId ||
      params.user_id ||
      params.clientUserId ||
      params.client_user_id ||
      params.userName ||
      params.user_name ||
      pathParams.customerId ||
      pathParams.id ||
      ""
    ).trim();

    // If request body contains customerId (for POST invocations)
    if (!customerId && event.body) {
      try {
        const parsedBody = JSON.parse(event.body);
        customerId = (
          parsedBody.customerId ||
          parsedBody.customer_id ||
          parsedBody.userId ||
          parsedBody.user_id ||
          parsedBody.userName ||
          parsedBody.user_name ||
          ""
        ).trim();
      } catch {
        // Body is not JSON
      }
    }

    if (params.limit) {
      const parsedLimit = parseInt(params.limit, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = Math.min(parsedLimit, 200);
      }
    }

    const isPlatform = !customerId;

    // 2. Build parameterized WHERE clause
    // Customer identifier maps directly to public.broadcasts.user_id, with user_name as companion
    let whereClause = "";
    let queryParams: any[] = [];

    if (!isPlatform) {
      whereClause = "WHERE (b.user_id::text = $1 OR (b.user_name IS NOT NULL AND (b.user_name = $1 OR LOWER(b.user_name) = LOWER($1))))";
      queryParams = [customerId];
    }

    // 3. Query Overview & Totals
    const totalsSql = `
      SELECT
        COUNT(*)::int AS total_broadcasts,
        COALESCE(SUM(b.total_recipients::bigint), 0)::bigint AS total_recipients,
        ROUND(AVG(b.total_recipients::numeric), 1) AS avg_recipients,
        MAX(b.total_recipients::bigint) AS max_recipients,
        MIN(b.total_recipients::bigint) AS min_recipients,
        MIN(COALESCE(b.sent_at, b.created_at))::text AS earliest_broadcast_at,
        MAX(COALESCE(b.sent_at, b.created_at))::text AS latest_broadcast_at,
        COUNT(*) FILTER (WHERE b.has_flow = true)::int AS has_flow_count
      FROM public.broadcasts b
      ${whereClause};
    `;

    const totalsResult = await executeBroadcastQuery<{
      total_broadcasts: number;
      total_recipients: string | number;
      avg_recipients: string | number | null;
      max_recipients: string | number | null;
      min_recipients: string | number | null;
      earliest_broadcast_at: string | null;
      latest_broadcast_at: string | null;
      has_flow_count: number;
    }>(totalsSql, queryParams);

    const totalsRow = totalsResult.rows[0] || {
      total_broadcasts: 0,
      total_recipients: 0,
      avg_recipients: null,
      max_recipients: null,
      min_recipients: null,
      earliest_broadcast_at: null,
      latest_broadcast_at: null,
      has_flow_count: 0,
    };

    const totalBroadcasts = Number(totalsRow.total_broadcasts) || 0;
    const totalRecipients = Number(totalsRow.total_recipients) || 0;
    const avgRecipients = totalsRow.avg_recipients !== null ? Number(totalsRow.avg_recipients) : null;
    const maxRecipients = totalsRow.max_recipients !== null ? Number(totalsRow.max_recipients) : null;
    const minRecipients = totalsRow.min_recipients !== null ? Number(totalsRow.min_recipients) : null;
    const hasFlowCount = Number(totalsRow.has_flow_count) || 0;
    const earliestBroadcastAt = totalsRow.earliest_broadcast_at;
    const latestBroadcastAt = totalsRow.latest_broadcast_at;

    // 4. Query Status Breakdown
    const statusSql = `
      SELECT
        COALESCE(b.status, 'UNKNOWN') AS status,
        COUNT(*)::int AS count,
        COALESCE(SUM(b.total_recipients::bigint), 0)::bigint AS recipients
      FROM public.broadcasts b
      ${whereClause}
      GROUP BY b.status
      ORDER BY count DESC;
    `;

    const statusResult = await executeBroadcastQuery<{
      status: string;
      count: number;
      recipients: string | number;
    }>(statusSql, queryParams);

    const statusBreakdown: Record<string, number> = {};
    const statusDetails: BroadcastStatusCount[] = statusResult.rows.map((row) => {
      const c = Number(row.count) || 0;
      const r = Number(row.recipients) || 0;
      statusBreakdown[row.status] = c;
      return {
        status: row.status,
        count: c,
        recipients: r,
      };
    });

    // 5. Query Media Type Breakdown
    const mediaSql = `
      SELECT
        COALESCE(b.media_type, 'text') AS media_type,
        COUNT(*)::int AS count,
        COALESCE(SUM(b.total_recipients::bigint), 0)::bigint AS recipients
      FROM public.broadcasts b
      ${whereClause}
      GROUP BY b.media_type
      ORDER BY count DESC;
    `;

    const mediaResult = await executeBroadcastQuery<{
      media_type: string;
      count: number;
      recipients: string | number;
    }>(mediaSql, queryParams);

    const mediaTypeBreakdown: Record<string, number> = {};
    const mediaTypeDetails: BroadcastMediaTypeCount[] = mediaResult.rows.map((row) => {
      const c = Number(row.count) || 0;
      const r = Number(row.recipients) || 0;
      mediaTypeBreakdown[row.media_type] = c;
      return {
        mediaType: row.media_type,
        count: c,
        recipients: r,
      };
    });

    // 6. Query Daily Time-Series Breakdown (for daily broadcast chart)
    const dailySql = `
      SELECT
        DATE(COALESCE(b.sent_at, b.created_at))::text AS date,
        COUNT(*)::int AS broadcasts,
        COALESCE(SUM(b.total_recipients::bigint), 0)::bigint AS recipients
      FROM public.broadcasts b
      ${whereClause}
      GROUP BY DATE(COALESCE(b.sent_at, b.created_at))
      ORDER BY date ASC;
    `;

    const dailyResult = await executeBroadcastQuery<{
      date: string;
      broadcasts: number;
      recipients: string | number;
    }>(dailySql, queryParams);

    const dailyBreakdown: BroadcastDailyCount[] = dailyResult.rows
      .filter((row) => row.date !== null && row.date !== "")
      .map((row) => ({
        date: row.date,
        broadcasts: Number(row.broadcasts) || 0,
        recipients: Number(row.recipients) || 0,
      }));

    // 7. Query Recent Broadcasts (Strictly omitting sensitive graph_api_token and payload)
    const recentLimitParamIndex = queryParams.length + 1;
    const recentParams = [...queryParams, limit];
    const recentSql = `
      SELECT
        b.id::text,
        b.user_id::text,
        b.user_name,
        b.campaign_name,
        b.template_name,
        b.message,
        b.message_txt,
        b.language,
        b.media_type,
        b.media_url,
        b.uploaded_file_url,
        b.media_handle,
        b.has_flow,
        b.business_phone_number_id,
        b.status,
        b.total_recipients::int,
        b.scheduled_at::text,
        b.sent_at::text,
        b.created_at::text,
        b.completed_at::text,
        b.updated_at::text
      FROM public.broadcasts b
      ${whereClause}
      ORDER BY COALESCE(b.sent_at, b.created_at) DESC NULLS LAST
      LIMIT $${recentLimitParamIndex};
    `;

    const recentResult = await executeBroadcastQuery<BroadcastRecord>(recentSql, recentParams);
    const recentBroadcasts: BroadcastRecord[] = recentResult.rows.map((r) => ({
      ...r,
      total_recipients: r.total_recipients !== null ? Number(r.total_recipients) : null,
    }));

    // 8. Assemble response matching Customer 360 and usage conventions
    const metrics: BroadcastUsageMetrics = {
      totalBroadcasts,
      totalRecipients,
      avgRecipients,
      maxRecipients,
      minRecipients,
      hasFlowCount,
      statusBreakdown,
      statusDetails,
      mediaTypeBreakdown,
      mediaTypeDetails,
      dailyBreakdown,
      earliestBroadcastAt,
      latestBroadcastAt,
      recentBroadcasts,
    };

    const response: GetBroadcastUsageResponse = {
      success: true,
      source: "postgresql_broadcasts",
      table: "public.broadcasts",
      scope: isPlatform ? "platform" : "customer",
      customerId: customerId || "",
      matchedIdentifier: customerId || undefined,
      queriedAt,
      count: totalBroadcasts,
      totalBroadcasts,
      totalRecipients,
      metrics,
      usageMetrics: [
        {
          id: `broadcasts-${customerId || "platform"}`,
          customer_id: customerId || "platform",
          metric_name: "broadcasts",
          metric_value: totalBroadcasts,
          metric_unit: "broadcasts",
          recorded_at: latestBroadcastAt,
          created_at: earliestBroadcastAt,
        },
        {
          id: `broadcast-recipients-${customerId || "platform"}`,
          customer_id: customerId || "platform",
          metric_name: "broadcast_recipients",
          metric_value: totalRecipients,
          metric_unit: "recipients",
          recorded_at: latestBroadcastAt,
          created_at: earliestBroadcastAt,
        },
      ],
      metricBreakdown: {
        broadcasts: {
          metricName: "broadcasts",
          count: totalBroadcasts,
          totalValue: totalBroadcasts,
          avgValue: totalRecipients > 0 && totalBroadcasts > 0 ? Math.round(totalRecipients / totalBroadcasts) : null,
          maxValue: maxRecipients,
          unit: "broadcasts",
          earliestRecordedAt: earliestBroadcastAt,
          latestRecordedAt: latestBroadcastAt,
        },
        broadcast_recipients: {
          metricName: "broadcast_recipients",
          count: totalBroadcasts,
          totalValue: totalRecipients,
          avgValue: totalRecipients > 0 && totalBroadcasts > 0 ? Math.round(totalRecipients / totalBroadcasts) : null,
          maxValue: maxRecipients,
          unit: "recipients",
          earliestRecordedAt: earliestBroadcastAt,
          latestRecordedAt: latestBroadcastAt,
        },
      },
    };

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error("Error executing getBroadcastUsageHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        source: "postgresql_broadcasts",
        table: "public.broadcasts",
        scope: customerId ? "customer" : "platform",
        customerId: customerId || "",
        count: 0,
        totalBroadcasts: 0,
        totalRecipients: 0,
        metrics: {
          totalBroadcasts: 0,
          totalRecipients: 0,
          avgRecipients: null,
          maxRecipients: null,
          minRecipients: null,
          hasFlowCount: 0,
          statusBreakdown: {},
          statusDetails: [],
          mediaTypeBreakdown: {},
          mediaTypeDetails: [],
          dailyBreakdown: [],
          earliestBroadcastAt: null,
          latestBroadcastAt: null,
          recentBroadcasts: [],
        },
        usageMetrics: [],
        metricBreakdown: {
          broadcasts: {
            metricName: "broadcasts",
            count: 0,
            totalValue: 0,
            avgValue: null,
            maxValue: null,
            unit: "broadcasts",
            earliestRecordedAt: null,
            latestRecordedAt: null,
          },
        },
        error: error?.message || "Failed to query operational database public.broadcasts",
        queriedAt,
      }),
    };
  }
}
