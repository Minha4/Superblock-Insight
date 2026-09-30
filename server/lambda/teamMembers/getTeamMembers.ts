import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  TeamMemberRecord,
  GetTeamMembersResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export async function getTeamMembersHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const params = event.queryStringParameters || {};
    const pathParams = event.pathParameters || {};
    const customerId = (
      params.customerId ||
      params.customer_id ||
      params.orgUserId ||
      params.org_user_id ||
      params.clientUserId ||
      params.client_user_id ||
      pathParams.customerId ||
      pathParams.id ||
      ""
    ).trim();

    if (!customerId) {
      const allSql = `
        SELECT 
          id::text,
          team_user_id,
          org_user_id,
          org_user_name,
          name,
          email,
          avatar_url,
          role,
          created_at::text
        FROM public.team_members
        ORDER BY created_at DESC;
      `;
      const allResult = await query<TeamMemberRecord>(allSql);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          count: allResult.rows.length,
          customerId: "",
          teamMembers: allResult.rows,
        } as GetTeamMembersResponse),
      };
    }

    const sql = `
      SELECT 
        id::text,
        team_user_id,
        org_user_id,
        org_user_name,
        name,
        email,
        avatar_url,
        role,
        created_at::text
      FROM public.team_members
      WHERE LOWER(org_user_id) = LOWER($1)
         OR LOWER(team_user_id) = LOWER($1)
         OR LOWER(email) = LOWER($1)
         OR id::text = $1
      ORDER BY created_at DESC;
    `;

    const result = await query<TeamMemberRecord>(sql, [customerId]);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        count: result.rows.length,
        customerId,
        teamMembers: result.rows,
      } as GetTeamMembersResponse),
    };
  } catch (error: any) {
    console.error("Error executing getTeamMembersHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        count: 0,
        customerId: "",
        teamMembers: [],
        error: error.message || "Failed to retrieve team members",
      } as GetTeamMembersResponse),
    };
  }
}
