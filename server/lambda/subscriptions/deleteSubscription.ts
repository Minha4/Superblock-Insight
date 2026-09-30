import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  DeleteSubscriptionResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "DELETE,OPTIONS",
};

export async function deleteSubscriptionHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const pathParams = event.pathParameters || {};
    const queryParams = event.queryStringParameters || {};
    let bodyId = "";
    if (event.body) {
      try {
        const parsed = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
        bodyId = parsed.id || "";
      } catch {}
    }

    const subId = (
      pathParams.id ||
      pathParams.subscriptionId ||
      queryParams.id ||
      bodyId
    ).trim();

    if (!subId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required subscription ID",
        } as DeleteSubscriptionResponse),
      };
    }

    const delSql = "DELETE FROM public.subscriptions WHERE id::text = $1 RETURNING id::text;";
    const result = await query(delSql, [subId]);

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Subscription not found with ID '${subId}'`,
        } as DeleteSubscriptionResponse),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        id: result.rows[0].id,
      } as DeleteSubscriptionResponse),
    };
  } catch (error: any) {
    console.error("Error executing deleteSubscriptionHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to delete subscription",
      } as DeleteSubscriptionResponse),
    };
  }
}
