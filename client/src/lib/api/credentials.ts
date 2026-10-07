import { fetchAuthSession } from "aws-amplify/auth";

export interface MetaCredentials {
  appId?: string | null;
  businessAccountId?: string | null;
  businessPhoneNumberId?: string | null;
  businessPortfolioId?: string | null;
  whatsappEndpoint?: string | null;
  hasToken: boolean;
  graphApiToken?: string | null;
}

export interface SuperblockCredentials {
  username: string;
  email: string;
  role?: string | null;
  plan?: string | null;
  loginUrl: string;
}

export interface FacebookCredentials {
  pageId?: string | null;
  pageName?: string | null;
  endpoint?: string | null;
  hasToken: boolean;
  accessToken?: string | null;
}

export interface InstagramCredentials {
  username?: string | null;
  endpoint?: string | null;
  hasToken: boolean;
  accessToken?: string | null;
}

export interface ShopifyCredentials {
  apiUrl?: string | null;
  hasToken: boolean;
  adminAccessToken?: string | null;
}

export interface CustomerCredentialsData {
  customerId: string;
  customerName: string;
  username: string;
  email: string;
  role?: string | null;
  plan?: string | null;
  status: "Configured" | "Partial" | "Unconfigured";
  updatedAt?: string | null;
  meta: MetaCredentials;
  superblock: SuperblockCredentials;
  channels: {
    facebook?: FacebookCredentials | null;
    instagram?: InstagramCredentials | null;
    shopify?: ShopifyCredentials | null;
  };
}

interface CredentialsResponse {
  success: boolean;
  customerId: string;
  credentials: CustomerCredentialsData | null;
  error?: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const session = await fetchAuthSession();
    const token = session?.tokens?.accessToken?.toString() || "";

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.warn("Could not retrieve Cognito auth session for credentials:", error);
  }

  return headers;
}

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    Boolean(import.meta.env.DEV) ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    host.startsWith("172.")
  );
}

const PRODUCTION_CREDENTIALS_GATEWAY =
  "https://gateway.superblock.chat/customeranalyticsdashaboard";

export function maskToken(token?: string | null): string | null {
  if (!token || !token.trim()) return null;
  const t = token.trim();
  if (t.includes("••••")) return t;
  if (t.length <= 8) return "••••••••";
  return `${t.slice(0, 4)}••••••••••••••••${t.slice(-4)}`;
}

export interface CustomerCredentialsContext {
  id?: string;
  company?: string;
  contact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  plan?: string;
  owner?: {
    name?: string;
  };
  activatedAt?: string;
  rawUser?: {
    user_id?: string;
    business_phone_number_id?: string | null;
    business_account_id?: string | null;
    business_portfolio_id?: string | null;
    app_id?: string | null;
    whatsapp_endpoint?: string | null;
    graph_api_token?: string | null;
    facebook_page_id?: string | null;
    facebook_page_name?: string | null;
    facebook_endpoint?: string | null;
    facebook_access_token?: string | null;
    instagram_username?: string | null;
    instagram_endpoint?: string | null;
    instagram_access_token?: string | null;
    shopify_api_url?: string | null;
    shopify_admin_access_token?: string | null;
    user_name?: string | null;
    user_email?: string | null;
    email?: string | null;
    created_at?: string | null;
  } | null;
  profile?: {
    user_id?: string;
    user_name?: string | null;
    email?: string | null;
    role?: string | null;
    plan?: string | null;
    updated_at?: string | null;
    phone?: string | null;
  } | null;
  rawCustomer?: any;
}

/**
 * Safely populates existing credentials fields with real customer data already fetched
 * for the selected customer. Leaves missing fields as null/unavailable without fabricating data.
 */
export function populateCredentialsWithRealData(
  base: CustomerCredentialsData,
  context?: CustomerCredentialsContext | null
): CustomerCredentialsData {
  if (!context) return base;

  // Real App ID (strictly from database/API schema: app_id)
  const realAppId =
    base.meta.appId ||
    context.rawUser?.app_id ||
    null;

  // Real Meta WhatsApp Phone ID (strictly from database/API schema: business_phone_number_id)
  const realPhoneId =
    base.meta.businessPhoneNumberId ||
    context.rawUser?.business_phone_number_id ||
    null;

  // Real Meta WhatsApp Business Account ID (strictly from database/API schema: business_account_id)
  const realWabaId =
    base.meta.businessAccountId ||
    context.rawUser?.business_account_id ||
    null;

  // Real Meta Business Portfolio ID (strictly from database/API schema: business_portfolio_id; null if unassigned)
  const realPortfolioId =
    base.meta.businessPortfolioId ||
    context.rawUser?.business_portfolio_id ||
    null;

  const realWhatsappEndpoint =
    base.meta.whatsappEndpoint ||
    context.rawUser?.whatsapp_endpoint ||
    "https://gateway.superblock.chat/sendWhatsappMessage";

  const realGraphApiToken =
    base.meta.graphApiToken ||
    (context.rawUser?.graph_api_token ? maskToken(context.rawUser.graph_api_token) : null);

  const hasToken = base.meta.hasToken || Boolean(realGraphApiToken);

  // Real SuperBlock Username
  const hasBetterUsername =
    context.rawUser?.user_name ||
    context.profile?.user_name ||
    (context.contact?.name && context.contact.name !== "—" ? context.contact.name.trim() : null) ||
    context.company;

  const realUsername =
    base.superblock.username && base.superblock.username !== base.customerId
      ? base.superblock.username
      : (hasBetterUsername || base.customerId);

  // Real SuperBlock Email
  const realEmail =
    base.superblock.email ||
    context.rawUser?.user_email ||
    context.rawUser?.email ||
    context.profile?.email ||
    (context.contact?.email && context.contact.email !== "—" ? context.contact.email.trim() : null) ||
    "";

  // Real Role (strictly from real role field; null if unavailable)
  const realRole =
    base.superblock.role ||
    context.profile?.role ||
    null;

  // Real Plan
  const realPlan =
    base.superblock.plan ||
    (context.plan && context.plan !== "—" ? context.plan.trim() : null) ||
    context.profile?.plan ||
    null;

  // Real Updated Date (strictly from real updated_at; null if unavailable)
  const realUpdatedAt =
    base.updatedAt ||
    context.profile?.updated_at ||
    null;

  const hasPhone = Boolean(realPhoneId && realPhoneId.trim().length > 0);
  const hasWaba = Boolean(realWabaId && realWabaId.trim().length > 0);

  let status: "Configured" | "Partial" | "Unconfigured" = base.status;
  if (hasToken && hasPhone) {
    status = "Configured";
  } else if (hasPhone || hasWaba || realPortfolioId) {
    status = "Partial";
  } else if (status !== "Configured") {
    status = "Unconfigured";
  }

  // Channels (Facebook, Instagram, Shopify)
  const fbPageId = base.channels?.facebook?.pageId || context.rawUser?.facebook_page_id || null;
  const fbToken = base.channels?.facebook?.accessToken || (context.rawUser?.facebook_access_token ? maskToken(context.rawUser.facebook_access_token) : null);
  const facebookChannel: FacebookCredentials | null = (fbPageId || fbToken)
    ? {
        pageId: fbPageId,
        pageName: base.channels?.facebook?.pageName || context.rawUser?.facebook_page_name || null,
        endpoint: base.channels?.facebook?.endpoint || context.rawUser?.facebook_endpoint || null,
        hasToken: Boolean(fbToken),
        accessToken: fbToken,
      }
    : (base.channels?.facebook || null);

  const igUsername = base.channels?.instagram?.username || context.rawUser?.instagram_username || null;
  const igToken = base.channels?.instagram?.accessToken || (context.rawUser?.instagram_access_token ? maskToken(context.rawUser.instagram_access_token) : null);
  const instagramChannel: InstagramCredentials | null = (igUsername || igToken)
    ? {
        username: igUsername,
        endpoint: base.channels?.instagram?.endpoint || context.rawUser?.instagram_endpoint || null,
        hasToken: Boolean(igToken),
        accessToken: igToken,
      }
    : (base.channels?.instagram || null);

  const shopifyUrl = base.channels?.shopify?.apiUrl || context.rawUser?.shopify_api_url || null;
  const shopifyToken = base.channels?.shopify?.adminAccessToken || (context.rawUser?.shopify_admin_access_token ? maskToken(context.rawUser.shopify_admin_access_token) : null);
  const shopifyChannel: ShopifyCredentials | null = (shopifyUrl || shopifyToken)
    ? {
        apiUrl: shopifyUrl,
        hasToken: Boolean(shopifyToken),
        adminAccessToken: shopifyToken,
      }
    : (base.channels?.shopify || null);

  return {
    ...base,
    customerName: context.company || base.customerName,
    username: realUsername,
    email: realEmail,
    role: realRole,
    plan: realPlan,
    status,
    updatedAt: realUpdatedAt,
    meta: {
      appId: realAppId,
      businessPhoneNumberId: realPhoneId,
      businessAccountId: realWabaId,
      businessPortfolioId: realPortfolioId,
      whatsappEndpoint: realWhatsappEndpoint,
      hasToken,
      graphApiToken: realGraphApiToken,
    },
    superblock: {
      ...base.superblock,
      username: realUsername,
      email: realEmail,
      role: realRole,
      plan: realPlan,
      loginUrl: base.superblock.loginUrl || "https://app.superblock.chat",
    },
    channels: {
      facebook: facebookChannel,
      instagram: instagramChannel,
      shopify: shopifyChannel,
    },
  };
}

/**
 * Builds an explicit unconfigured credentials record when a customer does not have
 * full credentials in the database. Populates available real fields from the customer context.
 * Never fabricates fake tokens or accounts.
 */
export function buildUnconfiguredCredentials(
  customerId: string,
  customerName = "",
  context?: CustomerCredentialsContext | null
): CustomerCredentialsData {
  const base: CustomerCredentialsData = {
    customerId,
    customerName: customerName || customerId,
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

  return populateCredentialsWithRealData(base, context);
}

/**
 * Retrieves real operational customer credentials (Meta WhatsApp, Superblock, Social & E-commerce).
 * Primary source: https://gateway.superblock.chat/customeranalyticsdashaboard?action=credentials
 * Local development fallback: /api/credentials
 * Never fabricates fake tokens or credentials.
 */
export async function getCustomerCredentials(
  customerId: string,
  customerName = "",
  context?: CustomerCredentialsContext | null
): Promise<CustomerCredentialsData | null> {
  if (!customerId) {
    throw new Error("Customer ID is required");
  }

  const headers = await authHeaders();

  // 1. Production Primary: Fetch through Gateway -> Lambda -> SuperBlock PostgreSQL public.users
  try {
    const params = new URLSearchParams();
    params.set("action", "credentials");
    params.set("customerId", customerId);
    if (customerName) {
      params.set("customerName", customerName);
    }

    const gatewayUrl = `${PRODUCTION_CREDENTIALS_GATEWAY}?${params.toString()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const gatewayRes = await fetch(gatewayUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (gatewayRes.ok) {
      const data = (await gatewayRes.json().catch(() => null)) as CredentialsResponse | null;
      if (data?.success && data.credentials) {
        return populateCredentialsWithRealData(data.credentials, context);
      }
    } else {
      console.warn(`Gateway credentials returned HTTP ${gatewayRes.status}, attempting local fallback`);
    }
  } catch (gwErr) {
    console.warn("Gateway credentials call failed, falling back to local API:", gwErr);
  }

  // 2. Safe local development fallback: /api/credentials
  try {
    const queryParams = new URLSearchParams();
    queryParams.set("customerId", customerId);
    if (customerName) {
      queryParams.set("customerName", customerName);
    }
    const localUrl = `/api/credentials?${queryParams.toString()}`;
    const response = await fetch(localUrl, { method: "GET", headers });
    if (response.ok) {
      const data = (await response.json().catch(() => null)) as CredentialsResponse | null;
      if (data?.success && data.credentials) {
        return populateCredentialsWithRealData(data.credentials, context);
      }
    }
  } catch (err) {
    console.warn("Local credentials fetch failed, returning unconfigured state with customer context:", err);
  }

  // 3. Graceful fallback with available real context without fabricated tokens or accounts
  return buildUnconfiguredCredentials(customerId, customerName, context);
}
