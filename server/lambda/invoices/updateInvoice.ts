import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  InvoiceRecord,
} from "../types";

export interface UpdateInvoiceInput {
  status?: string;
  amount?: number;
  currency?: string;
  issueDate?: string;
  issue_date?: string;
  dueDate?: string;
  due_date?: string;
  paidDate?: string | null;
  paid_date?: string | null;
  paymentDate?: string | null;
  description?: string;
  product?: string;
  customerId?: string;
  customer_id?: string;
}

export interface UpdateInvoiceResponse {
  success: boolean;
  invoice?: InvoiceRecord;
  error?: string;
}

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "PUT,PATCH,OPTIONS",
};

export async function updateInvoiceHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    let payload: UpdateInvoiceInput = {};
    if (event.body) {
      try {
        payload = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      } catch {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            error: "Malformed JSON payload",
          } as UpdateInvoiceResponse),
        };
      }
    }

    const rawId = (
      event.pathParameters?.id ||
      event.queryStringParameters?.id ||
      (payload as any).id ||
      (payload as any).invoice_number ||
      (payload as any).invoiceNumber ||
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
        } as UpdateInvoiceResponse),
      };
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (payload.status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(payload.status);

      // If status is Paid and no explicit paidDate provided, default to current date
      if (
        payload.status.toLowerCase() === "paid" &&
        payload.paidDate === undefined &&
        payload.paid_date === undefined &&
        payload.paymentDate === undefined
      ) {
        updates.push(`paid_date = $${idx++}`);
        values.push(new Date().toISOString().split("T")[0]);
      }
    }

    const rawPaid = payload.paidDate !== undefined ? payload.paidDate : (payload.paid_date !== undefined ? payload.paid_date : payload.paymentDate);
    if (rawPaid !== undefined) {
      updates.push(`paid_date = $${idx++}`);
      values.push(rawPaid ? String(rawPaid).slice(0, 10) : null);
    }

    if (payload.amount !== undefined) {
      const amt = Number(payload.amount);
      if (isNaN(amt) || amt < 0) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            error: "Amount must be a non-negative number",
          } as UpdateInvoiceResponse),
        };
      }
      updates.push(`amount = $${idx++}`);
      values.push(amt);
    }

    if (payload.currency !== undefined) {
      updates.push(`currency = $${idx++}`);
      values.push(payload.currency.trim().toUpperCase());
    }

    const issueDate = payload.issueDate || payload.issue_date;
    if (issueDate !== undefined) {
      updates.push(`issue_date = $${idx++}`);
      values.push(issueDate ? String(issueDate).slice(0, 10) : null);
    }

    const dueDate = payload.dueDate || payload.due_date;
    if (dueDate !== undefined) {
      updates.push(`due_date = $${idx++}`);
      values.push(dueDate ? String(dueDate).slice(0, 10) : null);
    }

    const desc = payload.description || payload.product;
    if (desc !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(desc);
    }

    if (updates.length === 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "No fields provided to update",
        } as UpdateInvoiceResponse),
      };
    }

    updates.push("updated_at = NOW()");
    values.push(rawId);
    const idParamIndex = idx;

    const updateSql = `
      UPDATE public.invoices
      SET ${updates.join(", ")}
      WHERE id::text = $${idParamIndex} OR invoice_number = $${idParamIndex}
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

    const result = await query<InvoiceRecord>(updateSql, values);

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Invoice '${rawId}' not found`,
        } as UpdateInvoiceResponse),
      };
    }

    const updatedRow = result.rows[0];
    const invoice: InvoiceRecord = {
      ...updatedRow,
      amount: Number(updatedRow.amount),
    };

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        invoice,
      } as UpdateInvoiceResponse),
    };
  } catch (error: any) {
    console.error("Error executing updateInvoiceHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to update invoice",
      } as UpdateInvoiceResponse),
    };
  }
}
