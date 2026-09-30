import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "../types";

export interface DeleteInvoiceResponse {
  success: boolean;
  id?: string;
  invoice_number?: string;
  error?: string;
}

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "DELETE,OPTIONS",
};

export async function deleteInvoiceHandler(
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
      payload.invoice_number ||
      payload.invoiceNumber ||
      (event.path ? event.path.split("/").filter(Boolean).pop() : "") ||
      ""
    ).trim();

    if (!rawId || rawId === "invoices") {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required invoice ID or invoice_number parameter",
        } as DeleteInvoiceResponse),
      };
    }

    const deleteSql = `
      DELETE FROM public.invoices
      WHERE id::text = $1 OR invoice_number = $1
      RETURNING id::text, invoice_number;
    `;

    const result = await query<{ id: string; invoice_number: string }>(deleteSql, [rawId]);

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Invoice '${rawId}' not found`,
        } as DeleteInvoiceResponse),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        id: result.rows[0].id,
        invoice_number: result.rows[0].invoice_number,
      } as DeleteInvoiceResponse),
    };
  } catch (error: any) {
    console.error("Error executing deleteInvoiceHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to delete invoice",
      } as DeleteInvoiceResponse),
    };
  }
}
