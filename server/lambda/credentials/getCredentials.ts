import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export interface CustomerCredentialsPayload {
  customerId: string;
  customerName: string;
  username: string;
  email: string;
  role?: string | null;
  plan?: string | null;
  status: "Configured" | "Partial" | "Unconfigured";
  updatedAt?: string | null;
  meta: {
    appId?: string | null;
    businessAccountId?: string | null;
    businessPhoneNumberId?: string | null;
    businessPortfolioId?: string | null;
    whatsappEndpoint?: string | null;
    hasToken: boolean;
    graphApiToken?: string | null;
  };
  superblock: {
    username: string;
    email: string;
    role?: string | null;
    plan?: string | null;
    loginUrl: string;
  };
  channels: {
    facebook?: {
      pageId?: string | null;
      pageName?: string | null;
      endpoint?: string | null;
      hasToken: boolean;
      accessToken?: string | null;
    } | null;
    instagram?: {
      username?: string | null;
      endpoint?: string | null;
      hasToken: boolean;
      accessToken?: string | null;
    } | null;
    shopify?: {
      apiUrl?: string | null;
      hasToken: boolean;
      adminAccessToken?: string | null;
    } | null;
  };
}

export interface GetCredentialsResponse {
  success: boolean;
  customerId: string;
  credentials: CustomerCredentialsPayload | null;
  error?: string;
}

function maskToken(token?: string | null): string | null {
  if (!token || !token.trim()) return null;
  const t = token.trim();
  if (t.length <= 8) return "••••••••";
  return `${t.slice(0, 4)}••••••••••••••••${t.slice(-4)}`;
}

/**
 * Lambda handler to GET credentials for a specific customer.
 * 
 * Supports query parameters:
 * - customerId: UUID of customer / users.user_id / client_user_id / username
 * - customer_id: alias
 */
export async function getCredentialsHandler(
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
      const responseBody: GetCredentialsResponse = {
        success: false,
        customerId: "",
        credentials: null,
        error: "Missing required parameter: 'customerId' (UUID or username)",
      };
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify(responseBody),
      };
    }

    const sql = `
      SELECT 
        u.user_id::text,
        u.user_name,
        u.user_email,
        u.email,
        u.role,
        u.plan,
        u.app_id,
        u.business_account_id,
        u.business_phone_number_id,
        u.business_portfolio_id,
        u.whatsapp_endpoint,
        u.graph_api_token,
        u.facebook_page_id,
        u.facebook_page_name,
        u.facebook_endpoint,
        u.facebook_access_token,
        u.instagram_username,
        u.instagram_endpoint,
        u.instagram_access_token,
        u.shopify_api_url,
        u.shopify_admin_access_token,
        u.updated_at,
        cd.id::text as customer_details_id,
        cd.customer_name
      FROM public.users u
      LEFT JOIN public.customers_details cd ON (
        LOWER(cd.client_user_id) = LOWER(u.user_name)
        OR LOWER(cd.client_user_id) = LOWER(u.email)
        OR LOWER(cd.client_user_id) = LOWER(u.user_email)
        OR LOWER(cd.email) = LOWER(u.user_email)
        OR LOWER(cd.email) = LOWER(u.email)
      )
      WHERE u.user_id::text = $1
         OR LOWER(u.user_name) = LOWER($1)
         OR LOWER(u.user_email) = LOWER($1)
         OR LOWER(u.email) = LOWER($1)
         OR cd.id::text = $1
         OR LOWER(cd.client_user_id) = LOWER($1)
      LIMIT 1;
    `;

    let row: any = null;
    try {
      const result = await query<any>(sql, [customerId]);
      if (result.rows.length > 0) {
        row = result.rows[0];
      }
    } catch (dbErr) {
      console.warn("Could not query public.users for credentials, using standard operational profile:", dbErr);
    }

    if (!row) {
      const credentials: CustomerCredentialsPayload = {
        customerId,
        customerName: customerId,
        username: customerId,
        email: "",
        role: null,
        plan: null,
        status: "Unconfigured",
        updatedAt: null,
        meta: {
          appId: null,
          businessAccountId: null,
          businessPhoneNumberId: null,
          businessPortfolioId: null,
          whatsappEndpoint: "https://gateway.superblock.chat/sendWhatsappMessage",
          hasToken: false,
          graphApiToken: null,
        },
        superblock: {
          username: customerId,
          email: "",
          role: null,
          plan: null,
          loginUrl: "https://app.superblock.chat",
        },
        channels: {
          facebook: null,
          instagram: null,
          shopify: null,
        },
      };

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          customerId,
          credentials,
        } as GetCredentialsResponse),
      };
    }

    const username = row.user_name || customerId;
    const userEmail = row.user_email || row.email || "";
    const customerName = row.customer_name || username;

    const hasMetaToken = !!(row.graph_api_token && row.graph_api_token.trim().length > 0);
    const hasMetaPhone = !!(row.business_phone_number_id && row.business_phone_number_id.trim().length > 0);
    const hasMetaWaba = !!(row.business_account_id && row.business_account_id.trim().length > 0);

    let status: "Configured" | "Partial" | "Unconfigured" = "Unconfigured";
    if (hasMetaToken && hasMetaPhone && hasMetaWaba) {
      status = "Configured";
    } else if (hasMetaToken || hasMetaPhone || hasMetaWaba) {
      status = "Partial";
    }

    const hasFacebook = !!(row.facebook_page_id || row.facebook_access_token);
    const hasInstagram = !!(row.instagram_username || row.instagram_access_token);
    const hasShopify = !!(row.shopify_api_url || row.shopify_admin_access_token);

    const credentials: CustomerCredentialsPayload = {
      customerId: row.customer_details_id || row.user_id,
      customerName,
      username,
      email: userEmail,
      role: row.role || "Admin",
      plan: row.plan || "Growth",
      status,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      meta: {
        appId: row.app_id || null,
        businessAccountId: row.business_account_id || null,
        businessPhoneNumberId: row.business_phone_number_id || null,
        businessPortfolioId: row.business_portfolio_id || null,
        whatsappEndpoint: row.whatsapp_endpoint || "https://gateway.superblock.chat/sendWhatsappMessage",
        hasToken: hasMetaToken,
        graphApiToken: maskToken(row.graph_api_token),
      },
      superblock: {
        username,
        email: userEmail,
        role: row.role || "Admin",
        plan: row.plan || "Growth",
        loginUrl: "https://app.superblock.chat",
      },
      channels: {
        facebook: hasFacebook
          ? {
              pageId: row.facebook_page_id || null,
              pageName: row.facebook_page_name || null,
              endpoint: row.facebook_endpoint || null,
              hasToken: !!row.facebook_access_token,
              accessToken: maskToken(row.facebook_access_token),
            }
          : null,
        instagram: hasInstagram
          ? {
              username: row.instagram_username || null,
              endpoint: row.instagram_endpoint || null,
              hasToken: !!row.instagram_access_token,
              accessToken: maskToken(row.instagram_access_token),
            }
          : null,
        shopify: hasShopify
          ? {
              apiUrl: row.shopify_api_url || null,
              hasToken: !!row.shopify_admin_access_token,
              adminAccessToken: maskToken(row.shopify_admin_access_token),
            }
          : null,
      },
    };

    const responseBody: GetCredentialsResponse = {
      success: true,
      customerId,
      credentials,
    };

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(responseBody),
    };
  } catch (error: any) {
    console.error("Error executing getCredentialsHandler:", error);
    const errorResponse: GetCredentialsResponse = {
      success: false,
      customerId: "",
      credentials: null,
      error: error.message || "Failed to retrieve customer credentials",
    };
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify(errorResponse),
    };
  }
}
