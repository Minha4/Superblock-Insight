import crypto from "node:crypto";
import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  CustomerOfferingRecord,
  GetCustomerOfferingsResponse,
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

export async function getCustomerOfferingsHandler(
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
          co.id::text,
          co.customer_id::text,
          co.product_id,
          co.offering_name,
          co.status,
          co.start_date::text,
          co.end_date::text,
          co.created_at::text,
          co.updated_at::text
        FROM public.customer_offerings co
        ORDER BY co.created_at DESC NULLS LAST;
      `;
      const allResult = await query<CustomerOfferingRecord>(allSql);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          count: allResult.rows.length,
          customerId: "",
          offerings: allResult.rows,
          customerOfferings: allResult.rows,
        } as GetCustomerOfferingsResponse),
      };
    }

    const resolvedUuid = toDeterministicUuid(rawCustomerId);

    const sql = `
      SELECT 
        co.id::text,
        co.customer_id::text,
        co.product_id,
        co.offering_name,
        co.status,
        co.start_date::text,
        co.end_date::text,
        co.created_at::text,
        co.updated_at::text
      FROM public.customer_offerings co
      WHERE co.customer_id = $1::uuid
         OR co.customer_id::text = $2
      ORDER BY co.created_at DESC NULLS LAST;
    `;

    const result = await query<CustomerOfferingRecord>(sql, [resolvedUuid, rawCustomerId]);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        count: result.rows.length,
        customerId: rawCustomerId,
        offerings: result.rows,
        customerOfferings: result.rows,
      } as GetCustomerOfferingsResponse),
    };
  } catch (error: any) {
    console.error("Error executing getCustomerOfferingsHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        count: 0,
        customerId: "",
        offerings: [],
        error: error.message || "Failed to retrieve customer offerings",
      } as GetCustomerOfferingsResponse),
    };
  }
}
