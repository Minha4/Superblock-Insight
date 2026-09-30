import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  DeleteTeamMemberResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "DELETE,OPTIONS",
};

export async function deleteTeamMemberHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const pathParams = event.pathParameters || {};
    const queryParams = event.queryStringParameters || {};
    let bodyId = "";
    if (event.body) {
      try {
        const parsed = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
        bodyId = parsed.id || parsed.email || "";
      } catch {}
    }

    const memberId = (
      pathParams.id ||
      pathParams.teamMemberId ||
      queryParams.id ||
      queryParams.email ||
      bodyId
    ).trim();

    if (!memberId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required team member ID or email",
        } as DeleteTeamMemberResponse),
      };
    }

    const delSql = `
      DELETE FROM public.team_members
      WHERE id::text = $1 OR team_user_id = $1 OR LOWER(email) = LOWER($1)
      RETURNING id::text;
    `;
    const result = await query(delSql, [memberId]);

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Team member not found for ID '${memberId}'`,
        } as DeleteTeamMemberResponse),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        id: result.rows[0].id,
      } as DeleteTeamMemberResponse),
    };
  } catch (error: any) {
    console.error("Error executing deleteTeamMemberHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to delete team member",
      } as DeleteTeamMemberResponse),
    };
  }
}
