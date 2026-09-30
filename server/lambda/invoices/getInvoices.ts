import crypto from "node:crypto";
import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  InvoiceRecord,
  GetInvoicesResponse,
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

export async function getInvoicesHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const params = event.queryStringParameters || {};
    const pathParams = event.pathParameters || {};
    const customerId = (
      params.customerId ||
      params.customer_id ||
      params.clientUserId ||
      params.client_user_id ||
      pathParams.customerId ||
      pathParams.id ||
      ""
    ).trim();

    if (!customerId) {
      const allSql = `
        SELECT 
          i.id::text,
          i.customer_id::text,
          i.invoice_number,
          i.status,
          i.amount::numeric,
          i.currency,
          i.issue_date::text,
          i.due_date::text,
          i.paid_date::text,
          i.description,
          i.created_at,
          i.updated_at
        FROM public.invoices i
        ORDER BY i.created_at DESC;
      `;
      const allResult = await query<InvoiceRecord>(allSql);
      const invoices = allResult.rows.map((r) => ({
        ...r,
        amount: Number(r.amount),
      }));

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          count: invoices.length,
          customerId: "",
          invoices,
        } as GetInvoicesResponse),
      };
    }

    const targetUuid = isUuid(customerId) ? customerId : toDeterministicUuid(customerId);
    const sql = `
      SELECT 
        i.id::text,
        i.customer_id::text,
        i.invoice_number,
        i.status,
        i.amount::numeric,
        i.currency,
        i.issue_date::text,
        i.due_date::text,
        i.paid_date::text,
        i.description,
        i.created_at,
        i.updated_at
      FROM public.invoices i
      WHERE i.customer_id::text = $1 OR i.customer_id::text = $2
      ORDER BY i.created_at DESC NULLS LAST;
    `;

    const result = await query<InvoiceRecord>(sql, [customerId, targetUuid]);
    const invoices = result.rows.map((r) => ({
      ...r,
      amount: Number(r.amount),
    }));

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        count: invoices.length,
        customerId,
        invoices,
      } as GetInvoicesResponse),
    };
  } catch (error: any) {
    console.error("Error executing getInvoicesHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        count: 0,
        customerId: "",
        invoices: [],
        error: error.message || "Failed to retrieve invoices",
      } as GetInvoicesResponse),
    };
  }
}
