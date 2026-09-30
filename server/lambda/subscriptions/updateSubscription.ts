import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  SubscriptionRecord,
  UpdateSubscriptionInput,
  UpdateSubscriptionResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "PUT,OPTIONS",
};

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    str
  );
}

function normalizeBillingInterval(val: any): "monthly" | "annual" | "quarterly" {
  if (!val || typeof val !== "string") return "monthly";
  const lower = val.trim().toLowerCase();
  if (lower === "annual" || lower === "yearly" || lower === "year") return "annual";
  if (lower === "quarterly" || lower === "quarter") return "quarterly";
  return "monthly";
}

export async function updateSubscriptionHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const pathParams = event.pathParameters || {};
    let payload: UpdateSubscriptionInput = {};
    if (event.body) {
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
          } as UpdateSubscriptionResponse),
        };
      }
    }

    const subId = (
      pathParams.id ||
      pathParams.subscriptionId ||
      (payload as any).id ||
      ""
    ).trim();

    if (!subId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required subscription ID",
        } as UpdateSubscriptionResponse),
      };
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (payload.customer_name !== undefined || payload.customer !== undefined) {
      const cName = (payload.customer_name ?? payload.customer ?? "").trim() || null;
      setClauses.push(`customer_name = $${idx++}`);
      values.push(cName);
    }
    if (payload.status !== undefined) {
      const rawStatus = (payload.status || "active").toString().trim().toLowerCase();
      const status = ["active", "pending", "cancelled", "trial", "past due", "renewal due"].includes(rawStatus)
        ? rawStatus
        : "active";
      setClauses.push(`status = $${idx++}`);
      values.push(status);
    }
    if (payload.startDate !== undefined || payload.start_date !== undefined) {
      setClauses.push(`start_date = $${idx++}`);
      values.push(payload.startDate ?? payload.start_date);
    }
    if (payload.endDate !== undefined || payload.end_date !== undefined || payload.renewalDate !== undefined) {
      setClauses.push(`end_date = $${idx++}`);
      values.push(payload.endDate ?? payload.end_date ?? payload.renewalDate);
    }
    if (payload.amount !== undefined || payload.mrr !== undefined) {
      setClauses.push(`amount = $${idx++}`);
      values.push(Number(payload.amount ?? payload.mrr) || 0);
    }
    if (payload.currency !== undefined) {
      setClauses.push(`currency = $${idx++}`);
      values.push(payload.currency);
    }
    if (payload.billingInterval !== undefined || payload.billing_interval !== undefined || payload.cycle !== undefined) {
      setClauses.push(`billing_interval = $${idx++}`);
      values.push(normalizeBillingInterval(payload.billingInterval ?? payload.billing_interval ?? payload.cycle));
    }

    const planInput = (payload.planId || payload.plan_id || payload.plan || "").trim();
    if (planInput) {
      if (isUuid(planInput)) {
        setClauses.push(`plan_id = $${idx++}::uuid`);
        values.push(planInput);
      } else {
        const planMatch = await query<{ id: string }>(
          "SELECT id::text FROM public.plans WHERE LOWER(name) = LOWER($1) LIMIT 1;",
          [planInput]
        );
        if (planMatch.rows.length > 0) {
          setClauses.push(`plan_id = $${idx++}::uuid`);
          values.push(planMatch.rows[0].id);
        } else {
          // Auto-provision plan tier in public.plans if not found
          const planNameClean = planInput.trim();
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
            setClauses.push(`plan_id = $${idx++}::uuid`);
            values.push(createdPlan.rows[0].id);
          }
        }
      }
    }

    setClauses.push(`updated_at = NOW()`);

    values.push(subId);
    const updateSql = `
      UPDATE public.subscriptions s
      SET ${setClauses.join(", ")}
      WHERE s.id::text = $${idx}
      RETURNING 
        s.id::text, s.customer_id::text, s.customer_name, s.plan_id::text, s.status,
        s.start_date::text, s.end_date::text, s.amount, s.currency,
        s.billing_interval, s.created_at::text, s.updated_at::text;
    `;

    const result = await query(updateSql, values);
    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Subscription not found with ID '${subId}'`,
        } as UpdateSubscriptionResponse),
      };
    }

    const r = result.rows[0];

    // Get plan name if plan_id exists
    let planName: string | null = null;
    if (r.plan_id) {
      const pRes = await query<{ name: string }>("SELECT name FROM public.plans WHERE id = $1;", [r.plan_id]);
      if (pRes.rows.length > 0) planName = pRes.rows[0].name;
    }

    const updatedSub: SubscriptionRecord = {
      id: r.id,
      customer_id: r.customer_id,
      customer_name: r.customer_name || null,
      plan_id: r.plan_id,
      status: r.status,
      start_date: r.start_date,
      end_date: r.end_date,
      amount: r.amount != null ? Number(r.amount) : 0,
      currency: r.currency || "INR",
      billing_interval: r.billing_interval || "monthly",
      created_at: r.created_at,
      updated_at: r.updated_at,
      plan_name: planName,
    };

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        subscription: updatedSub,
      } as UpdateSubscriptionResponse),
    };
  } catch (error: any) {
    console.error("Error executing updateSubscriptionHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to update subscription",
      } as UpdateSubscriptionResponse),
    };
  }
}
