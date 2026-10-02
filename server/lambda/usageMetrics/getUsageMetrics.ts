import { operationalQuery } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  UsageMetricRecord,
  MetricSummary,
  PlanMessageVolumeCustomer,
  PlanMetricsSummary,
  GetUsageMetricsResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export async function getUsageMetricsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const params = event.queryStringParameters || {};
    const pathParams = event.pathParameters || {};
    const customerId = (
      params.customerId ||
      params.customer_id ||
      params.clientUserId ||
      params.client_user_id ||
      pathParams.customerId ||
      pathParams.id ||
      ""
    ).trim();

    const isPlatform = !customerId;

    let usageRecords: UsageMetricRecord[] = [];
    const metricBreakdown: Record<string, MetricSummary> = {};
    let planMetrics: PlanMetricsSummary = {
      totalConfiguredMessageVolume: null,
      configuredCustomersCount: 0,
      customers: [],
      note: "Contracted/configured plan monthly message volume allowance, not verified outbound delivery counts.",
    };
    let totalContacts: number | null = null;
    let dbWarning: string | undefined;

    // 1. Query public.usage_metrics
    try {
      if (isPlatform) {
        // Platform-wide usage metrics: fetch most recent recorded metrics
        const recordsSql = `
          SELECT
            um.id::text,
            um.customer_id::text,
            um.metric_name,
            um.metric_value::numeric,
            um.metric_unit,
            um.recorded_at,
            um.created_at
          FROM public.usage_metrics um
          ORDER BY um.recorded_at DESC NULLS LAST, um.created_at DESC NULLS LAST
          LIMIT 500;
        `;
        const recordsResult = await operationalQuery<UsageMetricRecord>(recordsSql);
        usageRecords = recordsResult.rows.map((row) => ({
          ...row,
          metric_value: row.metric_value !== null ? Number(row.metric_value) : null,
        }));

        // Platform-wide metric aggregations by actual metric_name
        const aggSql = `
          SELECT
            um.metric_name,
            COUNT(*)::int AS count,
            SUM(um.metric_value::numeric) AS total_value,
            ROUND(AVG(um.metric_value::numeric), 2) AS avg_value,
            MAX(um.metric_value::numeric) AS max_value,
            MIN(um.metric_unit) AS unit,
            MIN(um.recorded_at)::text AS earliest_recorded_at,
            MAX(um.recorded_at)::text AS latest_recorded_at
          FROM public.usage_metrics um
          WHERE um.metric_name IS NOT NULL
          GROUP BY um.metric_name
          ORDER BY count DESC;
        `;
        const aggResult = await operationalQuery<{
          metric_name: string;
          count: number;
          total_value: string | number | null;
          avg_value: string | number | null;
          max_value: string | number | null;
          unit: string | null;
          earliest_recorded_at: string | null;
          latest_recorded_at: string | null;
        }>(aggSql);

        for (const row of aggResult.rows) {
          metricBreakdown[row.metric_name] = {
            metricName: row.metric_name,
            count: Number(row.count),
            totalValue: row.total_value !== null ? Number(row.total_value) : null,
            avgValue: row.avg_value !== null ? Number(row.avg_value) : null,
            maxValue: row.max_value !== null ? Number(row.max_value) : null,
            unit: row.unit,
            earliestRecordedAt: row.earliest_recorded_at,
            latestRecordedAt: row.latest_recorded_at,
          };
        }
      } else {
        // Customer-specific usage metrics
        const recordsSql = `
          SELECT
            um.id::text,
            um.customer_id::text,
            um.metric_name,
            um.metric_value::numeric,
            um.metric_unit,
            um.recorded_at,
            um.created_at
          FROM public.usage_metrics um
          WHERE um.customer_id::text = $1
             OR um.customer_id IN (
               SELECT cd.id
               FROM public.customers_details cd
               WHERE LOWER(cd.client_user_id) = LOWER($1)
             )
          ORDER BY um.recorded_at DESC NULLS LAST, um.created_at DESC NULLS LAST;
        `;
        const recordsResult = await operationalQuery<UsageMetricRecord>(recordsSql, [customerId]);
        usageRecords = recordsResult.rows.map((row) => ({
          ...row,
          metric_value: row.metric_value !== null ? Number(row.metric_value) : null,
        }));

        // Customer metric aggregation
        const aggSql = `
          SELECT
            um.metric_name,
            COUNT(*)::int AS count,
            SUM(um.metric_value::numeric) AS total_value,
            ROUND(AVG(um.metric_value::numeric), 2) AS avg_value,
            MAX(um.metric_value::numeric) AS max_value,
            MIN(um.metric_unit) AS unit,
            MIN(um.recorded_at)::text AS earliest_recorded_at,
            MAX(um.recorded_at)::text AS latest_recorded_at
          FROM public.usage_metrics um
          WHERE (um.customer_id::text = $1
             OR um.customer_id IN (
               SELECT cd.id
               FROM public.customers_details cd
               WHERE LOWER(cd.client_user_id) = LOWER($1)
             ))
            AND um.metric_name IS NOT NULL
          GROUP BY um.metric_name
          ORDER BY count DESC;
        `;
        const aggResult = await operationalQuery<{
          metric_name: string;
          count: number;
          total_value: string | number | null;
          avg_value: string | number | null;
          max_value: string | number | null;
          unit: string | null;
          earliest_recorded_at: string | null;
          latest_recorded_at: string | null;
        }>(aggSql, [customerId]);

        for (const row of aggResult.rows) {
          metricBreakdown[row.metric_name] = {
            metricName: row.metric_name,
            count: Number(row.count),
            totalValue: row.total_value !== null ? Number(row.total_value) : null,
            avgValue: row.avg_value !== null ? Number(row.avg_value) : null,
            maxValue: row.max_value !== null ? Number(row.max_value) : null,
            unit: row.unit,
            earliestRecordedAt: row.earliest_recorded_at,
            latestRecordedAt: row.latest_recorded_at,
          };
        }
      }
    } catch (err: any) {
      console.warn("Could not query public.usage_metrics from operational database:", err?.message || err);
      dbWarning = `Operational usage_metrics query notice: ${err?.message || "Table unpopulated or database offline"}`;
    }

    // 2. Query public.users.message_volume (plan / monthly contracted volume)
    try {
      if (isPlatform) {
        const usersSql = `
          SELECT
            u.user_id::text,
            COALESCE(u.user_name, u.email, u.user_email) AS user_name,
            u.plan,
            u.message_volume::numeric AS message_volume
          FROM public.users u
          WHERE u.message_volume IS NOT NULL AND u.message_volume::numeric > 0
          ORDER BY u.message_volume::numeric DESC;
        `;
        const usersResult = await operationalQuery<{
          user_id: string;
          user_name: string | null;
          plan: string | null;
          message_volume: string | number;
        }>(usersSql);

        const customers: PlanMessageVolumeCustomer[] = usersResult.rows.map((r) => ({
          userId: r.user_id,
          userName: r.user_name,
          plan: r.plan,
          messageVolume: Number(r.message_volume),
        }));

        const totalVol = customers.reduce((acc, c) => acc + c.messageVolume, 0);

        planMetrics = {
          totalConfiguredMessageVolume: totalVol > 0 ? totalVol : null,
          configuredCustomersCount: customers.length,
          customers,
          note: "Contracted/configured plan monthly message volume allowance, not verified outbound delivery counts.",
        };
      } else {
        const userSql = `
          SELECT
            u.user_id::text,
            COALESCE(u.user_name, u.email, u.user_email) AS user_name,
            u.plan,
            u.message_volume::numeric AS message_volume
          FROM public.users u
          WHERE LOWER(u.user_id::text) = LOWER($1)
             OR LOWER(u.user_name) = LOWER($1)
             OR LOWER(u.email) = LOWER($1)
             OR LOWER(u.user_email) = LOWER($1)
          LIMIT 1;
        `;
        const userResult = await operationalQuery<{
          user_id: string;
          user_name: string | null;
          plan: string | null;
          message_volume: string | number | null;
        }>(userSql, [customerId]);

        if (userResult.rows.length > 0) {
          const row = userResult.rows[0];
          const vol = row.message_volume !== null ? Number(row.message_volume) : null;
          planMetrics = {
            totalConfiguredMessageVolume: vol,
            configuredCustomersCount: vol !== null ? 1 : 0,
            customers: vol !== null
              ? [
                  {
                    userId: row.user_id,
                    userName: row.user_name,
                    plan: row.plan,
                    messageVolume: vol,
                  },
                ]
              : [],
            note: "Contracted/configured plan monthly message volume allowance, not verified outbound delivery counts.",
          };
        }
      }
    } catch (err: any) {
      console.warn("Could not query public.users.message_volume from operational database:", err?.message || err);
      if (!dbWarning) {
        dbWarning = `Operational users query notice: ${err?.message || "Table unpopulated or database offline"}`;
      }
    }

    // 3. Query public.customer_contacts
    try {
      if (isPlatform) {
        const contactsSql = `SELECT COUNT(*)::int AS total_contacts FROM public.customer_contacts;`;
        const contactsResult = await operationalQuery<{ total_contacts: number }>(contactsSql);
        if (contactsResult.rows.length > 0) {
          totalContacts = Number(contactsResult.rows[0].total_contacts);
        }
      } else {
        const contactsSql = `
          SELECT COUNT(*)::int AS total_contacts
          FROM public.customer_contacts cc
          WHERE LOWER(cc.client_user_id) = LOWER($1)
             OR cc.customer_id::text = $1;
        `;
        const contactsResult = await operationalQuery<{ total_contacts: number }>(contactsSql, [customerId]);
        if (contactsResult.rows.length > 0) {
          totalContacts = Number(contactsResult.rows[0].total_contacts);
        }
      }
    } catch (err: any) {
      console.warn("Could not query public.customer_contacts from operational database:", err?.message || err);
    }

    const responsePayload: GetUsageMetricsResponse = {
      success: true,
      scope: isPlatform ? "platform" : "customer",
      count: usageRecords.length,
      customerId: isPlatform ? undefined : customerId,
      usageMetrics: usageRecords,
      metricBreakdown,
      planMetrics,
      contactsSummary: {
        totalContacts,
      },
      warning: dbWarning,
    };

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(responsePayload),
    };
  } catch (error: any) {
    console.error("Error executing getUsageMetricsHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        scope: "platform",
        count: 0,
        customerId: "",
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
        error: error.message || "Failed to retrieve usage metrics",
      } as GetUsageMetricsResponse),
    };
  }
}
