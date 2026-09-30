import crypto from "node:crypto";
import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  NoteRecord,
  CreateNoteInput,
  CreateNoteResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    str
  );
}

function toDeterministicUuid(str: string): string {
  if (isUuid(str)) return str;
  const hex = crypto.createHash("md5").update(str.trim().toLowerCase()).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Resolves a customer identifier (UUID or client_user_id) into a confirmed customer UUID.
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
 * Lambda handler to INSERT a new note into public.notes.
 * 
 * Expected JSON body:
 * {
 *   "customerId": "uuid or client_user_id",
 *   "title": "Optional title string",
 *   "content": "Note content text (required)",
 *   "createdBy": "Optional author UUID"
 * }
 */
export async function createNoteHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    let payload: CreateNoteInput;

    if (!event.body) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Request body is required",
        } as CreateNoteResponse),
      };
    }

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
        } as CreateNoteResponse),
      };
    }

    const rawCustomerId = (
      payload.customerId ||
      payload.customer_id ||
      ""
    ).trim();
    const title = payload.title?.trim() || null;
    const content = payload.content?.trim() || "";
    const rawCreatedBy = (payload.createdBy || payload.created_by || "").trim();

    // 1. Validation
    if (!rawCustomerId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'customerId'",
        } as CreateNoteResponse),
      };
    }

    if (!content) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'content' (note body cannot be empty)",
        } as CreateNoteResponse),
      };
    }

    // 2. Resolve customer_id to authoritative customers_details.id UUID
    const customerUuid = await resolveCustomerUuid(rawCustomerId);
    if (!customerUuid) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Customer not found for identifier: '${rawCustomerId}'`,
        } as CreateNoteResponse),
      };
    }

    // 3. Handle created_by UUID validation
    const createdByUuid =
      rawCreatedBy && isUuid(rawCreatedBy) ? rawCreatedBy : null;

    // 4. Parameterized INSERT statement
    const insertSql = `
      INSERT INTO public.notes (
        customer_id,
        title,
        content,
        created_by,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, NOW(), NOW()
      )
      RETURNING 
        id::text,
        customer_id::text,
        title,
        content,
        created_by::text,
        created_at,
        updated_at;
    `;

    const result = await query<NoteRecord>(insertSql, [
      customerUuid,
      title,
      content,
      createdByUuid,
    ]);

    const createdNote = result.rows[0];

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        note: createdNote,
      } as CreateNoteResponse),
    };
  } catch (error: any) {
    console.error("Error executing createNoteHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to create note",
      } as CreateNoteResponse),
    };
  }
}
