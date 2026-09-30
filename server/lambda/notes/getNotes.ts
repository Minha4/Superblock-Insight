import crypto from "node:crypto";
import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  NoteRecord,
  GetNotesResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
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
 * Lambda handler to GET notes for a specific customer.
 * 
 * Supports query parameters:
 * - customerId: UUID of customer or client_user_id
 * - customer_id: alias for customerId
 */
export async function getNotesHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Extract customer identifier from queryStringParameters or pathParameters
    const params = event.queryStringParameters || {};
    const pathParams = event.pathParameters || {};
    const customerId = (
      params.customerId ||
      params.customer_id ||
      pathParams.customerId ||
      pathParams.id ||
      ""
    ).trim();

    if (!customerId) {
      const responseBody: GetNotesResponse = {
        success: false,
        count: 0,
        customerId: "",
        notes: [],
        error: "Missing required parameter: 'customerId' (UUID or client_user_id)",
      };
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify(responseBody),
      };
    }

    let notes: NoteRecord[] = [];
    const targetUuid = isUuid(customerId) ? customerId : toDeterministicUuid(customerId);

    // Direct query against public.notes without requiring legacy customers_details table
    const sql = `
      SELECT 
        n.id::text,
        n.customer_id::text,
        n.title,
        n.content,
        n.created_by::text,
        n.created_at,
        n.updated_at
      FROM public.notes n
      WHERE n.customer_id::text = $1 OR n.customer_id::text = $2
      ORDER BY n.created_at DESC;
    `;
    const result = await query<NoteRecord>(sql, [customerId, targetUuid]);
    notes = result.rows;

    const responseBody: GetNotesResponse = {
      success: true,
      count: notes.length,
      customerId,
      notes,
    };

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(responseBody),
    };
  } catch (error: any) {
    console.error("Error executing getNotesHandler:", error);
    const errorResponse: GetNotesResponse = {
      success: false,
      count: 0,
      customerId: "",
      notes: [],
      error: error.message || "Failed to retrieve customer notes",
    };
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify(errorResponse),
    };
  }
}
