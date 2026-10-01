import crypto from "node:crypto";
import { query } from "../db";
import { toIsoDate } from "../invoices/createInvoice";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  CustomerOfferingRecord,
  CreateCustomerOfferingInput,
  CreateCustomerOfferingResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function toDeterministicUuid(str: string): string {
  if (isUuid(str)) return str;
  const hex = crypto.createHash("md5").update(str.trim().toLowerCase()).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function createCustomerOfferingHandler(
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
        } as CreateCustomerOfferingResponse),
      };
    }

    let payload: CreateCustomerOfferingInput;
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
        } as CreateCustomerOfferingResponse),
      };
    }

    const rawCustomerId = (
      payload.customerId ||
      payload.customer_id ||
      ""
    ).trim();

    const productId = payload.productId || payload.product_id || null;
    const offeringName = (payload.offeringName || payload.offering_name || "").trim() || null;

    if (!rawCustomerId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'customerId'",
        } as CreateCustomerOfferingResponse),
      };
    }

    if (!offeringName && !productId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Either 'offeringName' or 'productId' is required",
        } as CreateCustomerOfferingResponse),
      };
    }

    const customerUuid = toDeterministicUuid(rawCustomerId);

    let resolvedOfferingName = offeringName;
    if (productId) {
      const prodCheck = await query<{ id: string; name: string }>(
        "SELECT id, name FROM public.products WHERE id = $1 LIMIT 1;",
        [productId]
      );
      if (prodCheck.rows.length > 0 && !resolvedOfferingName) {
        resolvedOfferingName = prodCheck.rows[0].name;
      }
    }
    if (!resolvedOfferingName) {
      resolvedOfferingName = productId || "Custom Offering";
    }

    const status = payload.status || "active";
    const startDate = toIsoDate(payload.startDate || payload.start_date);
    const endDate = toIsoDate(payload.endDate || payload.end_date);

    const insertSql = `
      INSERT INTO public.customer_offerings (
        id, customer_id, product_id, offering_name, status,
        start_date, end_date, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1::uuid, $2, $3, $4,
        $5, $6, NOW(), NOW()
      )
      RETURNING 
        id::text, customer_id::text, product_id, offering_name, status,
        start_date::text, end_date::text, created_at::text, updated_at::text;
    `;

    const result = await query<CustomerOfferingRecord>(insertSql, [
      customerUuid, productId, resolvedOfferingName, status, startDate, endDate
    ]);

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        offering: result.rows[0],
        customerOffering: result.rows[0],
      } as CreateCustomerOfferingResponse),
    };
  } catch (error: any) {
    console.error("Error executing createCustomerOfferingHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to create customer offering",
      } as CreateCustomerOfferingResponse),
    };
  }
}
