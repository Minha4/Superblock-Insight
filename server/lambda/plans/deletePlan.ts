import { query } from "../db";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "../types";

export interface DeletePlanResponse {
  success: boolean;
  id?: string;
  name?: string;
  error?: string;
}

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "DELETE,OPTIONS",
};

export async function deletePlanHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    let payload: any = {};
    if (event.body) {
      try {
        payload = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      } catch {}
    }

    const rawId = (
      event.pathParameters?.id ||
      event.queryStringParameters?.id ||
      payload.id ||
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
        } as DeletePlanResponse),
      };
    }

    const deleteSql = `
      DELETE FROM public.plans
      WHERE id::text = $1 OR name = $1
      RETURNING id::text, name;
    `;

    const result = await query<{ id: string; name: string }>(deleteSql, [rawId]);

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Plan '${rawId}' not found`,
        } as DeletePlanResponse),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        id: result.rows[0].id,
        name: result.rows[0].name,
      } as DeletePlanResponse),
    };
  } catch (error: any) {
    console.error("Error executing deletePlanHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to delete plan from database",
      } as DeletePlanResponse),
    };
  }
}
