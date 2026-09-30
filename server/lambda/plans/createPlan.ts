import { query } from "../db";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "../types";
import type { PlanRecord } from "./getPlans";

export interface CreatePlanInput {
  id?: string;
  name: string;
  product?: string;
  monthly?: number;
  annual?: number;
  limit?: string;
  features?: number;
  status?: string;
  description?: string;
}

export interface CreatePlanResponse {
  success: boolean;
  plan?: PlanRecord;
  error?: string;
}

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export async function createPlanHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Request body cannot be empty",
        } as CreatePlanResponse),
      };
    }

    let payload: CreatePlanInput;
    try {
      payload = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Malformed JSON payload",
        } as CreatePlanResponse),
      };
    }

    const name = (payload.name || "").trim();
    if (!name) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Plan name is required",
        } as CreatePlanResponse),
      };
    }

    const product = (payload.product || "Omnichannel Suite").trim();
    const monthly = typeof payload.monthly === "number" ? Math.max(0, payload.monthly) : (Number(payload.monthly) || 0);
    const annual = typeof payload.annual === "number" ? Math.max(0, payload.annual) : (Number(payload.annual) || Math.round(monthly * 10));
    const limit = (payload.limit || "Standard limits").trim();
    const features = typeof payload.features === "number" ? Math.max(0, payload.features) : (Number(payload.features) || 8);
    const status = (payload.status || "Active").trim();
    const description = payload.description !== undefined ? String(payload.description).trim() : null;

    let insertSql = "";
    let params: any[] = [];

    if (payload.id && isUuid(payload.id.trim())) {
      insertSql = `
        INSERT INTO public.plans (
          id,
          name,
          product,
          monthly,
          annual,
          "limit",
          features,
          status,
          description
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
      params = [payload.id.trim(), name, product, monthly, annual, limit, features, status, description];
    } else {
      insertSql = `
        INSERT INTO public.plans (
          name,
          product,
          monthly,
          annual,
          "limit",
          features,
          status,
          description
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
      params = [name, product, monthly, annual, limit, features, status, description];
    }

    const result = await query<PlanRecord>(insertSql, params);
    const row = result.rows[0];
    const createdPlan: PlanRecord = {
      ...row,
      monthly: Number(row.monthly) || 0,
      annual: Number(row.annual) || 0,
      features: Number(row.features) || 0,
    };

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        plan: createdPlan,
      } as CreatePlanResponse),
    };
  } catch (error: any) {
    console.error("Error executing createPlanHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to create plan in database",
      } as CreatePlanResponse),
    };
  }
}
