import { query } from "../db";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "DELETE,OPTIONS",
};

export async function deleteCustomerOfferingHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const rawId = event.pathParameters?.id || event.queryStringParameters?.id;
    if (!rawId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, error: "Missing required offering id" }),
      };
    }

    const res = await query(
      "DELETE FROM public.customer_offerings WHERE id = $1 RETURNING id::text;",
      [rawId]
    );

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        id: rawId,
        deleted: (res.rowCount ?? 0) > 0,
      }),
    };
  } catch (error: any) {
    console.error("Error executing deleteCustomerOfferingHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to delete customer offering",
      }),
    };
  }
}
