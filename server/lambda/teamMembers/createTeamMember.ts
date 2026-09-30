import crypto from "node:crypto";
import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  TeamMemberRecord,
  CreateTeamMemberInput,
  CreateTeamMemberResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
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

export async function createTeamMemberHandler(
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
        } as CreateTeamMemberResponse),
      };
    }

    let payload: CreateTeamMemberInput;
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
        } as CreateTeamMemberResponse),
      };
    }

    const orgUserId = (
      payload.customerId ||
      payload.orgUserId ||
      payload.org_user_id ||
      "superblock"
    ).trim() || "superblock";

    const orgUserName = (
      payload.orgUserName ||
      payload.org_user_name ||
      "Superblock HQ"
    ).trim();

    const name = (payload.name || "").trim();
    const email = (payload.email || "").trim().toLowerCase();

    if (!name) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'name'",
        } as CreateTeamMemberResponse),
      };
    }

    if (!email) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'email'",
        } as CreateTeamMemberResponse),
      };
    }

    // Check if team member already exists with this email
    const existing = await query<{ id: string; email: string }>(
      "SELECT id::text, email FROM public.team_members WHERE LOWER(email) = LOWER($1) LIMIT 1;",
      [email]
    );
    if (existing.rows.length > 0) {
      return {
        statusCode: 409,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `A team member with email '${email}' already exists`,
        } as CreateTeamMemberResponse),
      };
    }



    const randStr = crypto.randomBytes(3).toString("hex");
    const teamUserId = (
      payload.teamUserId ||
      payload.team_user_id ||
      (payload as any).id ||
      `tm_${Date.now()}_${randStr}`
    ).trim();

    const role = normalizeRole(payload.role);
    const avatarUrl = payload.avatarUrl || payload.avatar_url || null;
    const passwordHash = payload.passwordHash || payload.password_hash || null;

    const insertSql = `
      INSERT INTO public.team_members (
        id, team_user_id, org_user_id, org_user_name, name, email,
        avatar_url, role, password_hash, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5,
        $6, $7, $8, NOW()
      )
      RETURNING 
        id::text, team_user_id, org_user_id, org_user_name, name, email,
        avatar_url, role, password_hash, created_at::text;
    `;

    const result = await query<TeamMemberRecord>(insertSql, [
      teamUserId, orgUserId, orgUserName, name, email,
      avatarUrl, role, passwordHash
    ]);

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        teamMember: result.rows[0],
      } as CreateTeamMemberResponse),
    };
  } catch (error: any) {
    console.error("Error executing createTeamMemberHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to create team member",
      } as CreateTeamMemberResponse),
    };
  }
}
