import crypto from "node:crypto";
import { query } from "../db";
import { toIsoDate } from "../invoices/createInvoice";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  SubscriptionRecord,
  CreateSubscriptionInput,
  CreateSubscriptionResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    str
  );
}

function toDeterministicUuid(str: string): string {
  if (isUuid(str)) return str;
  const hex = crypto.createHash("md5").update(str.trim().toLowerCase()).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function normalizeBillingInterval(val: any): "monthly" | "annual" | "quarterly" {
  if (!val || typeof val !== "string") return "monthly";
  const lower = val.trim().toLowerCase();
  if (lower === "annual" || lower === "yearly" || lower === "year") return "annual";
  if (lower === "quarterly" || lower === "quarter") return "quarterly";
  return "monthly";
}

export async function createSubscriptionHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Request body is required",
        } as CreateSubscriptionResponse),
      };
    }

    let payload: CreateSubscriptionInput;
    try {
      payload =
        typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Invalid JSON format in request body",
        } as CreateSubscriptionResponse),
      };
    }

    const rawCustomerId = (
      payload.customerId ||
      payload.customer_id ||
      ""
    ).trim();

    const rawPlanIdentifier = (
      payload.planId ||
      payload.plan_id ||
      payload.plan ||
      ""
    ).trim();

    if (!rawCustomerId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'customerId'",
        } as CreateSubscriptionResponse),
      };
    }

    const customerUuid = toDeterministicUuid(rawCustomerId);

    let resolvedPlanId: string | null = null;
    let resolvedPlanName: string | null = null;

    if (rawPlanIdentifier) {
      if (isUuid(rawPlanIdentifier)) {
        const planCheck = await query<{ id: string; name: string }>(
          "SELECT id::text, name FROM public.plans WHERE id = $1 LIMIT 1;",
          [rawPlanIdentifier]
        );
        if (planCheck.rows.length > 0) {
          resolvedPlanId = planCheck.rows[0].id;
          resolvedPlanName = planCheck.rows[0].name;
        } else {
          resolvedPlanId = rawPlanIdentifier;
        }
      } else {
        const planCheck = await query<{ id: string; name: string }>(
          "SELECT id::text, name FROM public.plans WHERE LOWER(name) = LOWER($1) LIMIT 1;",
          [rawPlanIdentifier]
        );
        if (planCheck.rows.length > 0) {
          resolvedPlanId = planCheck.rows[0].id;
          resolvedPlanName = planCheck.rows[0].name;
        } else {
          // Auto-provision plan tier in public.plans if not found
          const planNameClean = rawPlanIdentifier.trim();
          const isEnt = planNameClean.toLowerCase() === "enterprise";
          const seedTier = {
            name: planNameClean,
            product: "Omnichannel Suite",
            monthly: isEnt ? 0 : 2699,
            annual: isEnt ? 0 : 27530,
            limit: isEnt ? "Contracted" : "Unlimited broadcasts",
            features: isEnt ? 24 : 12,
            status: "Active",
          };
          const createdPlan = await query<{ id: string; name: string }>(
            `INSERT INTO public.plans (id, name, product, monthly, annual, "limit", features, status, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
             RETURNING id::text, name;`,
            [seedTier.name, seedTier.product, seedTier.monthly, seedTier.annual, seedTier.limit, seedTier.features, seedTier.status]
          );
          if (createdPlan.rows.length > 0) {
            resolvedPlanId = createdPlan.rows[0].id;
            resolvedPlanName = createdPlan.rows[0].name;
          }
        }
      }
    }

    const rawStatus = (payload.status || "active").toString().trim().toLowerCase();
    const status = ["active", "pending", "cancelled", "trial", "past due", "renewal due"].includes(rawStatus)
      ? rawStatus
      : "active";
    const startDate = toIsoDate(payload.startDate || payload.start_date) || new Date().toISOString().split("T")[0];
    const endDate = toIsoDate(payload.endDate || payload.end_date || payload.renewalDate);
    const amount = typeof payload.amount === "number" ? payload.amount : (typeof payload.mrr === "number" ? payload.mrr : null);
    const currency = payload.currency || "INR";
    const billingInterval = normalizeBillingInterval(
      payload.billingInterval || payload.billing_interval || payload.cycle
    );

    const customerName = (payload.customer_name || payload.customer || "").trim() || null;
    const explicitId = (payload.id || "").trim();
    const hasCustomUuid = isUuid(explicitId);

    const insertSql = hasCustomUuid
      ? `
        INSERT INTO public.subscriptions (
          id, customer_id, customer_name, plan_id, status, start_date, end_date,
          amount, currency, billing_interval, created_at, updated_at
        ) VALUES (
          $10::uuid, $1::uuid, $2, $3, $4, $5,
          $6, $7, $8, $9, NOW(), NOW()
        )
        RETURNING 
          id::text, customer_id::text, customer_name, plan_id::text, status, start_date::text,
          end_date::text, amount, currency, billing_interval,
          created_at::text, updated_at::text;
      `
      : `
        INSERT INTO public.subscriptions (
          id, customer_id, customer_name, plan_id, status, start_date, end_date,
          amount, currency, billing_interval, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1::uuid, $2, $3, $4, $5,
          $6, $7, $8, $9, NOW(), NOW()
        )
        RETURNING 
          id::text, customer_id::text, customer_name, plan_id::text, status, start_date::text,
          end_date::text, amount, currency, billing_interval,
          created_at::text, updated_at::text;
      `;

    const queryParams = hasCustomUuid
      ? [
          customerUuid,
          customerName,
          resolvedPlanId ? resolvedPlanId : null,
          status,
          startDate,
          endDate,
          amount,
          currency,
          billingInterval,
          explicitId,
        ]
      : [
          customerUuid,
          customerName,
          resolvedPlanId ? resolvedPlanId : null,
          status,
          startDate,
          endDate,
          amount,
          currency,
          billingInterval,
        ];

    const result = await query(insertSql, queryParams);

    const r = result.rows[0];
    const createdSub: SubscriptionRecord = {
      id: r.id,
      customer_id: r.customer_id,
      customer_name: r.customer_name || customerName,
      plan_id: r.plan_id,
      status: r.status || "active",
      start_date: r.start_date,
      end_date: r.end_date,
      amount: r.amount != null ? Number(r.amount) : 0,
      currency: r.currency || "INR",
      billing_interval: r.billing_interval || "monthly",
      created_at: r.created_at,
      updated_at: r.updated_at,
      plan_name: resolvedPlanName || null,
    };

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        subscription: createdSub,
      } as CreateSubscriptionResponse),
    };
  } catch (error: any) {
    console.error("Error executing createSubscriptionHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to create subscription",
      } as CreateSubscriptionResponse),
    };
  }
}
