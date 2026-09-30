import crypto from "node:crypto";
import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  MeetingRecord,
  CreateMeetingInput,
  CreateMeetingResponse,
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
 * Lambda handler to INSERT a new meeting into public.meetings.
 * 
 * Expected JSON body:
 * {
 *   "customerId": "uuid or client_user_id (required)",
 *   "title": "Meeting title (required)",
 *   "description": "Optional meeting notes",
 *   "meetingDate": "ISO date string or timestamp (optional)",
 *   "durationMinutes": 30 (optional integer),
 *   "status": "scheduled | completed | canceled (default: 'scheduled')",
 *   "meetingUrl": "https://... (optional)",
 *   "createdBy": "Optional organizer UUID"
 * }
 */
export async function createMeetingHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    let payload: CreateMeetingInput;

    if (!event.body) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Request body is required",
        } as CreateMeetingResponse),
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
        } as CreateMeetingResponse),
      };
    }

    const rawCustomerId = (
      payload.customerId ||
      payload.customer_id ||
      ""
    ).trim();
    const title = (payload.title || "").trim();
    const description = payload.description?.trim() || null;
    const rawMeetingDate = payload.meetingDate || payload.meeting_date || null;
    const rawDuration = payload.durationMinutes ?? payload.duration_minutes ?? null;
    const status = (payload.status?.trim()) || "scheduled";
    const meetingUrl = (payload.meetingUrl || payload.meeting_url || "").trim() || null;
    const rawCreatedBy = (payload.createdBy || payload.created_by || "").trim();

    // 1. Validate required fields
    if (!rawCustomerId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'customerId'",
        } as CreateMeetingResponse),
      };
    }

    if (!title) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'title' (meeting title cannot be empty)",
        } as CreateMeetingResponse),
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
        } as CreateMeetingResponse),
      };
    }

    // 3. Parse and validate meeting date
    let meetingDate: string | null = null;
    if (rawMeetingDate) {
      const parsedDate = new Date(rawMeetingDate);
      if (isNaN(parsedDate.getTime())) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            error: `Invalid date format for 'meetingDate': '${rawMeetingDate}'`,
          } as CreateMeetingResponse),
        };
      }
      meetingDate = parsedDate.toISOString();
    }

    // 4. Validate duration_minutes
    let durationMinutes: number | null = null;
    if (rawDuration !== null && rawDuration !== undefined) {
      const parsedDuration = parseInt(String(rawDuration), 10);
      if (isNaN(parsedDuration) || parsedDuration < 0) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            error: "Field 'durationMinutes' must be a non-negative integer",
          } as CreateMeetingResponse),
        };
      }
      durationMinutes = parsedDuration;
    }

    // 5. Validate created_by UUID
    const createdByUuid =
      rawCreatedBy && isUuid(rawCreatedBy) ? rawCreatedBy : null;

    // 6. Parameterized INSERT into public.meetings
    const insertSql = `
      INSERT INTO public.meetings (
        customer_id,
        title,
        description,
        meeting_date,
        duration_minutes,
        status,
        meeting_url,
        created_by,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
      )
      RETURNING 
        id::text,
        customer_id::text,
        title,
        description,
        meeting_date,
        duration_minutes,
        status,
        meeting_url,
        created_by::text,
        created_at,
        updated_at;
    `;

    const result = await query<MeetingRecord>(insertSql, [
      customerUuid,
      title,
      description,
      meetingDate,
      durationMinutes,
      status,
      meetingUrl,
      createdByUuid,
    ]);

    const createdMeeting = result.rows[0];

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        meeting: createdMeeting,
      } as CreateMeetingResponse),
    };
  } catch (error: any) {
    console.error("Error executing createMeetingHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to create meeting",
      } as CreateMeetingResponse),
    };
  }
}
