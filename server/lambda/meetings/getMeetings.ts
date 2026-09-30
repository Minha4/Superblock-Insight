import crypto from "node:crypto";
import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  MeetingRecord,
  GetMeetingsResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

/**
 * Validates whether a string is a standard UUID.
 */
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
 * Lambda handler to GET meetings for a specific customer.
 * 
 * Supports query parameters:
 * - customerId: UUID of customer or client_user_id
 * - customer_id: alias for customerId
 * 
 * Orders by meeting_date DESC NULLS LAST, with created_at DESC as secondary ordering.
 */
export async function getMeetingsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
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
      const responseBody: GetMeetingsResponse = {
        success: false,
        count: 0,
        customerId: "",
        meetings: [],
        error: "Missing required parameter: 'customerId' (UUID or client_user_id)",
      };
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify(responseBody),
      };
    }

    let meetings: MeetingRecord[] = [];
    const targetUuid = isUuid(customerId) ? customerId : toDeterministicUuid(customerId);

    const sql = `
      SELECT 
        m.id::text,
        m.customer_id::text,
        m.title,
        m.description,
        m.meeting_date,
        m.duration_minutes,
        m.status,
        m.meeting_url,
        m.created_by::text,
        m.created_at,
        m.updated_at
      FROM public.meetings m
      WHERE m.customer_id::text = $1 OR m.customer_id::text = $2
      ORDER BY m.meeting_date DESC NULLS LAST, m.created_at DESC;
    `;
    const result = await query<MeetingRecord>(sql, [customerId, targetUuid]);
    meetings = result.rows;

    const responseBody: GetMeetingsResponse = {
      success: true,
      count: meetings.length,
      customerId,
      meetings,
    };

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(responseBody),
    };
  } catch (error: any) {
    console.error("Error executing getMeetingsHandler:", error);
    const errorResponse: GetMeetingsResponse = {
      success: false,
      count: 0,
      customerId: "",
      meetings: [],
      error: error.message || "Failed to retrieve customer meetings",
    };
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify(errorResponse),
    };
  }
}
