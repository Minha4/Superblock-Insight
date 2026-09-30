import { query } from "../db";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "../types";

export interface PlanRecord {
  id: string;
  name: string;
  product: string;
  monthly: number;
  annual: number;
  limit: string;
  features: number;
  status: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface GetPlansResponse {
  success: boolean;
  count: number;
  plans: PlanRecord[];
  error?: string;
}

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export async function getPlansHandler(
  _event?: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const sql = `
      SELECT 
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
        updated_at
      FROM public.plans
      ORDER BY created_at ASC;
    `;

    const result = await query<PlanRecord>(sql);
    const plans: PlanRecord[] = result.rows.map((r) => ({
      ...r,
      monthly: Number(r.monthly) || 0,
      annual: Number(r.annual) || 0,
      features: Number(r.features) || 0,
    }));

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        count: plans.length,
        plans,
      } as GetPlansResponse),
    };
  } catch (error: any) {
    console.error("Error executing getPlansHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        count: 0,
        plans: [],
        error: error.message || "Failed to retrieve plans from database",
      } as GetPlansResponse),
    };
  }
}
