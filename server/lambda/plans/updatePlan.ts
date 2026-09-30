import { query } from "../db";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "../types";
import type { PlanRecord } from "./getPlans";

export interface UpdatePlanInput {
  name?: string;
  product?: string;
  monthly?: number;
  annual?: number;
  limit?: string;
  features?: number;
  status?: string;
  description?: string;
}

export interface UpdatePlanResponse {
  success: boolean;
  plan?: PlanRecord;
  error?: string;
}

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "PUT,PATCH,OPTIONS",
};

export async function updatePlanHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    let payload: UpdatePlanInput = {};
    if (event.body) {
      try {
        payload = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      } catch {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            error: "Malformed JSON payload",
          } as UpdatePlanResponse),
        };
      }
    }

    const rawId = (
      event.pathParameters?.id ||
      event.queryStringParameters?.id ||
      (payload as any).id ||
      (event.path ? event.path.split("/").filter(Boolean).pop() : "") ||
      ""
    ).trim();

    if (!rawId || rawId === "plans") {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required plan ID parameter",
        } as UpdatePlanResponse),
      };
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (payload.name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(payload.name.trim());
    }

    if (payload.product !== undefined) {
      updates.push(`product = $${idx++}`);
      values.push(payload.product.trim());
    }

    if (payload.monthly !== undefined) {
      const monthly = typeof payload.monthly === "number" ? Math.max(0, payload.monthly) : (Number(payload.monthly) || 0);
      updates.push(`monthly = $${idx++}`);
      values.push(monthly);
    }

    if (payload.annual !== undefined) {
      const annual = typeof payload.annual === "number" ? Math.max(0, payload.annual) : (Number(payload.annual) || 0);
      updates.push(`annual = $${idx++}`);
      values.push(annual);
    }

    if (payload.limit !== undefined) {
      updates.push(`"limit" = $${idx++}`);
      values.push(payload.limit.trim());
    }

    if (payload.features !== undefined) {
      const features = typeof payload.features === "number" ? Math.max(0, payload.features) : (Number(payload.features) || 0);
      updates.push(`features = $${idx++}`);
      values.push(features);
    }

    if (payload.status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(payload.status.trim());
    }

    if (payload.description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(payload.description ? String(payload.description).trim() : null);
    }

    if (updates.length === 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "No fields provided to update",
        } as UpdatePlanResponse),
      };
    }

    updates.push("updated_at = NOW()");
    values.push(rawId);
    const idParamIdx = idx;

    const updateSql = `
      UPDATE public.plans
      SET ${updates.join(", ")}
      WHERE id::text = $${idParamIdx} OR name = $${idParamIdx}
      RETURNING 
        id::text,
        name,
        product,
        monthly::numeric,
        annual::numeric,
        "limit",
        features,
        status,
        description,
        created_at,
        updated_at;
    `;

    const result = await query<PlanRecord>(updateSql, values);

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Plan '${rawId}' not found`,
        } as UpdatePlanResponse),
      };
    }

    const row = result.rows[0];
    const updatedPlan: PlanRecord = {
      ...row,
      monthly: Number(row.monthly) || 0,
      annual: Number(row.annual) || 0,
      features: Number(row.features) || 0,
    };

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        plan: updatedPlan,
      } as UpdatePlanResponse),
    };
  } catch (error: any) {
    console.error("Error executing updatePlanHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to update plan in database",
      } as UpdatePlanResponse),
    };
  }
}
