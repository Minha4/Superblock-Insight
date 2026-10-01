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

// Production Cognito configuration for Superblock Insight
export const COGNITO_PROD_CONFIG = {
  region: "ap-south-1",
  userPoolId: "ap-south-1_zvqUmSP2y",
  clientId: "6hrdibr3fdis15rb72qg2erssn",
  staleClientIds: new Set(["4t46u2ot1h9b9d5no9qsnt2fgj"]),
  staleUserPoolIds: new Set(["ap-south-1_O2viAa5cM"]),
};

export function resolveCognitoClientId(): string {
  const envCandidates = [
    process.env.COGNITO_CLIENT_ID,
    process.env.VITE_AWS_USER_POOLS_WEB_CLIENT_ID,
    process.env.NEXT_PUBLIC_AWS_USER_POOLS_WEB_CLIENT_ID,
    process.env.AWS_USER_POOLS_WEB_CLIENT_ID,
  ];

  for (const candidate of envCandidates) {
    if (candidate && typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed && !COGNITO_PROD_CONFIG.staleClientIds.has(trimmed)) {
        return trimmed;
      }
    }
  }

  return COGNITO_PROD_CONFIG.clientId;
}

export function resolveCognitoRegion(): string {
  return (
    process.env.AWS_REGION ||
    process.env.VITE_AWS_REGION ||
    process.env.NEXT_PUBLIC_AWS_REGION ||
    COGNITO_PROD_CONFIG.region
  );
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



    // Dispatch real invitation email via AWS Cognito User Pool
    const cognitoClientId = resolveCognitoClientId();
    const cognitoRegion = resolveCognitoRegion();
    const cognitoUsername = `team_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const tempPassword = `Sb!${crypto.randomBytes(4).toString("hex").toUpperCase()}#${Date.now()}a`;

    let cognitoSub: string | null = null;
    let codeDeliveryDetails: any = null;

    try {
      console.log(`[Team Invite] Dispatching Cognito SignUp to client ${cognitoClientId} in ${cognitoRegion} for ${email}`);
      const cognitoResponse = await fetch(
        `https://cognito-idp.${cognitoRegion}.amazonaws.com/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "AWSCognitoIdentityProviderService.SignUp",
          },
          body: JSON.stringify({
            ClientId: cognitoClientId,
            Username: cognitoUsername,
            Password: tempPassword,
            UserAttributes: [
              { Name: "email", Value: email },
              { Name: "name", Value: name },
            ],
          }),
        }
      );

      const cognitoData = (await cognitoResponse.json()) as any;

      if (!cognitoResponse.ok) {
        if (
          cognitoData?.__type === "UsernameExistsException" ||
          cognitoData?.__type === "AliasExistsException"
        ) {
          console.warn(`Cognito user already registered with email ${email}`);
        } else {
          console.error("Cognito SignUp error:", cognitoData);
          return {
            statusCode: cognitoResponse.status || 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({
              success: false,
              error:
                cognitoData?.message ||
                "Failed to dispatch invitation through authentication provider",
            } as CreateTeamMemberResponse),
          };
        }
      } else {
        cognitoSub = cognitoData?.UserSub || null;
        codeDeliveryDetails = cognitoData?.CodeDeliveryDetails || null;
        console.log(
          `[Team Invite] Cognito invitation dispatched successfully for ${email}. Sub: ${cognitoSub}, Destination: ${codeDeliveryDetails?.Destination}`
        );
      }
    } catch (cognitoErr: any) {
      console.error("Error communicating with Cognito IDP service:", cognitoErr);
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Authentication provider unreachable: ${cognitoErr?.message || "Connection failed"}`,
        } as CreateTeamMemberResponse),
      };
    }

    const randStr = crypto.randomBytes(3).toString("hex");
    const teamUserId = (
      cognitoSub ||
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
      teamUserId,
      orgUserId,
      orgUserName,
      name,
      email,
      avatarUrl,
      role,
      passwordHash,
    ]);

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        teamMember: result.rows[0],
        deliveryDetails: codeDeliveryDetails,
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
