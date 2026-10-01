import crypto from "node:crypto";
import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  InvoiceRecord,
} from "../types";

export interface CreateInvoiceInput {
  customerId?: string;
  customer_id?: string;
  invoiceNumber?: string;
  invoice_number?: string;
  amount: number;
  currency?: string;
  status?: string;
  issueDate?: string;
  issue_date?: string;
  dueDate?: string;
  due_date?: string;
  paidDate?: string | null;
  paid_date?: string | null;
  description?: string;
}

export interface CreateInvoiceResponse {
  success: boolean;
  invoice?: InvoiceRecord;
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

function toDeterministicUuid(str: string): string {
  if (isUuid(str)) return str;
  const hex = crypto.createHash("md5").update(str.trim().toLowerCase()).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function toIsoDate(d: any): string | null {
  if (!d) return null;
  const s = String(d).trim();
  if (!s || s === "—" || s === "-") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  try {
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  } catch {}
  return null;
}

/**
 * Resolves a customer identifier into a confirmed customer UUID.
 * Returns the UUID directly without querying the legacy customers_details table.
 */
async function resolveCustomerUuid(identifier: string): Promise<string | null> {
  const trimmed = (identifier || "").trim();
  if (!trimmed) return null;
  if (isUuid(trimmed)) {
    return trimmed;
  }
  return toDeterministicUuid(trimmed);
}

/**
 * Lambda handler to INSERT a new invoice into public.invoices.
 */
export async function createInvoiceHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    let payload: CreateInvoiceInput;

    if (!event.body) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Request body cannot be empty",
        } as CreateInvoiceResponse),
      };
    }

    try {
      payload = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Malformed JSON payload",
        } as CreateInvoiceResponse),
      };
    }

    const rawCustomerId = (payload.customerId || payload.customer_id || "").trim();
    if (!rawCustomerId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'customerId'",
        } as CreateInvoiceResponse),
      };
    }

    if (payload.amount === undefined || payload.amount === null) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Amount must be a non-negative number",
        } as CreateInvoiceResponse),
      };
    }

    const amount = Number(payload.amount);
    if (isNaN(amount) || amount < 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Amount must be a non-negative number",
        } as CreateInvoiceResponse),
      };
    }

    const resolvedCustomerId = await resolveCustomerUuid(rawCustomerId);
    if (!resolvedCustomerId) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Customer '${rawCustomerId}' not found in database`,
        } as CreateInvoiceResponse),
      };
    }
    const customerId = resolvedCustomerId;

    const invoiceNumber = (
      payload.invoiceNumber ||
      payload.invoice_number ||
      (payload as any).id ||
      ""
    ).trim() || `INV-${Date.now().toString(36).toUpperCase()}`;

    const currency = (payload.currency || "INR").trim().toUpperCase();
    const status = (payload.status || "Sent").trim();
    const description = (payload.description || (payload as any).product || "Platform & Software Services").trim();
    const rawIssueDate = payload.issueDate || payload.issue_date || (payload as any).date;
    const issueDate = toIsoDate(rawIssueDate) || new Date().toISOString().split("T")[0];
    const rawDueDate = payload.dueDate || payload.due_date;
    const dueDate = toIsoDate(rawDueDate) || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
    const rawPaidDate = payload.paidDate || payload.paid_date || (payload as any).paymentDate;
    const paidDate = toIsoDate(rawPaidDate) || (status.toLowerCase() === "paid" ? issueDate : null);

    const insertSql = `
      INSERT INTO public.invoices (
        customer_id,
        invoice_number,
        status,
        amount,
        currency,
        issue_date,
        due_date,
        paid_date,
        description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING 
        id::text,
        customer_id::text,
        invoice_number,
        status,
        amount::numeric,
        currency,
        issue_date::text,
        due_date::text,
        paid_date::text,
        description,
        created_at,
        updated_at;
    `;

    const result = await query<InvoiceRecord>(insertSql, [
      customerId,
      invoiceNumber,
      status,
      amount,
      currency,
      issueDate,
      dueDate,
      paidDate,
      description,
    ]);

    const row = result.rows[0];
    const createdInvoice: InvoiceRecord = {
      ...row,
      amount: Number(row.amount),
    };

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        invoice: createdInvoice,
      } as CreateInvoiceResponse),
    };
  } catch (error: any) {
    console.error("Error executing createInvoiceHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to create invoice",
      } as CreateInvoiceResponse),
    };
  }
}
