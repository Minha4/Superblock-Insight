import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  TeamMemberRecord,
  UpdateTeamMemberInput,
  UpdateTeamMemberResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "PUT,OPTIONS",
};

function normalizeRole(roleInput?: string): "Admin" | "Manager" | "Agent" | "Member" {
  if (!roleInput) return "Member";
  const normalized = roleInput.trim().toLowerCase();
  if (normalized === "admin") return "Admin";
  if (
    normalized === "manager" ||
    normalized.includes("lead") ||
    normalized.includes("head") ||
    normalized.includes("director")
  ) {
    return "Manager";
  }
  if (
    normalized === "agent" ||
    normalized.includes("support") ||
    normalized.includes("specialist") ||
    normalized.includes("success")
  ) {
    return "Agent";
  }
  return "Member";
}

export async function updateTeamMemberHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const pathParams = event.pathParameters || {};
    let payload: UpdateTeamMemberInput = {};
    if (event.body) {
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
          } as UpdateTeamMemberResponse),
        };
      }
    }

    const memberId = (
      pathParams.id ||
      pathParams.teamMemberId ||
      (payload as any).id ||
      ""
    ).trim();

    if (!memberId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required team member ID",
        } as UpdateTeamMemberResponse),
      };
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;



    if (payload.name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      values.push(payload.name.trim());
    }
    if (payload.email !== undefined) {
      setClauses.push(`email = $${idx++}`);
      values.push(payload.email.trim().toLowerCase());
    }
    if (payload.role !== undefined) {
      setClauses.push(`role = $${idx++}`);
      values.push(normalizeRole(payload.role));
    }
    if (payload.avatarUrl !== undefined || payload.avatar_url !== undefined) {
      setClauses.push(`avatar_url = $${idx++}`);
      values.push(payload.avatarUrl ?? payload.avatar_url);
    }

    if (setClauses.length === 0) {
      const existing = await query<TeamMemberRecord>(
        "SELECT id::text, team_user_id, org_user_id, org_user_name, name, email, avatar_url, role, password_hash, created_at::text FROM public.team_members WHERE id::text = $1 OR team_user_id = $1 OR LOWER(email) = LOWER($1);",
        [memberId]
      );
      if (existing.rows.length === 0) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            error: `Team member not found for ID '${memberId}'`,
          } as UpdateTeamMemberResponse),
        };
      }
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          teamMember: existing.rows[0],
        } as UpdateTeamMemberResponse),
      };
    }

    values.push(memberId);
    const updateSql = `
      UPDATE public.team_members
      SET ${setClauses.join(", ")}
      WHERE id::text = $${idx} OR team_user_id = $${idx} OR LOWER(email) = LOWER($${idx})
      RETURNING 
        id::text, team_user_id, org_user_id, org_user_name, name, email,
        avatar_url, role, password_hash, created_at::text;
    `;

    const result = await query<TeamMemberRecord>(updateSql, values);
    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Team member not found for ID '${memberId}'`,
        } as UpdateTeamMemberResponse),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        teamMember: result.rows[0],
      } as UpdateTeamMemberResponse),
    };
  } catch (error: any) {
    console.error("Error executing updateTeamMemberHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to update team member",
      } as UpdateTeamMemberResponse),
    };
  }
}
