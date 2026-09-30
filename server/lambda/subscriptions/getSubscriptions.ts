import crypto from "node:crypto";
import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  SubscriptionRecord,
  GetSubscriptionsResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function toDeterministicUuid(str: string): string {
  if (isUuid(str)) return str;
  const hex = crypto.createHash("md5").update(str.trim().toLowerCase()).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function mapSubscriptionRow(r: any): SubscriptionRecord {
  return {
    id: r.id,
    customer_id: r.customer_id,
    customer_name: r.customer_name || null,
    plan_id: r.plan_id,
    status: r.status || "active",
    start_date: r.start_date || null,
    end_date: r.end_date || null,
    amount: r.amount != null ? Number(r.amount) : 0,
    currency: r.currency || "INR",
    billing_interval: r.billing_interval || "monthly",
    created_at: r.created_at,
    updated_at: r.updated_at,
    plan_name: r.plan_name || null,
  };
}

export async function getSubscriptionsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const params = event.queryStringParameters || {};
    const pathParams = event.pathParameters || {};
    const rawCustomerId = (
      params.customerId ||
      params.customer_id ||
      params.clientUserId ||
      params.client_user_id ||
      pathParams.customerId ||
      pathParams.id ||
      ""
    ).trim();

    if (!rawCustomerId) {
      const allSql = `
        SELECT 
          s.id::text,
          s.customer_id::text,
          s.customer_name,
          s.plan_id::text,
          s.status,
          s.start_date::text,
          s.end_date::text,
          s.amount,
          s.currency,
          s.billing_interval,
          s.created_at::text,
          s.updated_at::text,
          p.name as plan_name
        FROM public.subscriptions s
        LEFT JOIN public.plans p ON s.plan_id = p.id
        ORDER BY s.created_at DESC NULLS LAST;
      `;
      const allResult = await query(allSql);
      const mapped = allResult.rows.map(mapSubscriptionRow);

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          count: mapped.length,
          customerId: "",
          subscriptions: mapped,
        } as GetSubscriptionsResponse),
      };
    }

    const resolvedUuid = toDeterministicUuid(rawCustomerId);

    const sql = `
      SELECT 
        s.id::text,
        s.customer_id::text,
        s.customer_name,
        s.plan_id::text,
        s.status,
        s.start_date::text,
        s.end_date::text,
        s.amount,
        s.currency,
        s.billing_interval,
        s.created_at::text,
        s.updated_at::text,
        p.name as plan_name
      FROM public.subscriptions s
      LEFT JOIN public.plans p ON s.plan_id = p.id
      WHERE s.customer_id = $1::uuid
         OR s.customer_id::text = $2
      ORDER BY s.created_at DESC NULLS LAST;
    `;

    const result = await query(sql, [resolvedUuid, rawCustomerId]);
    const mapped = result.rows.map(mapSubscriptionRow);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        count: mapped.length,
        customerId: rawCustomerId,
        subscriptions: mapped,
      } as GetSubscriptionsResponse),
    };
  } catch (error: any) {
    console.error("Error executing getSubscriptionsHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        count: 0,
        customerId: "",
        subscriptions: [],
        error: error.message || "Failed to retrieve subscriptions",
      } as GetSubscriptionsResponse),
    };
  }
}
