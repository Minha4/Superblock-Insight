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
  const hasToken = base.meta.hasToken;

  let status: "Configured" | "Partial" | "Unconfigured" = base.status;
  if (hasToken && hasPhone) {
    status = "Configured";
  } else if (hasPhone || hasWaba || realPortfolioId) {
    status = "Partial";
  } else if (status !== "Configured") {
    status = "Unconfigured";
  }

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
      ...base.meta,
      businessPhoneNumberId: realPhoneId,
      businessAccountId: realWabaId,
      businessPortfolioId: realPortfolioId,
      // appId, whatsappEndpoint, hasToken, graphApiToken are preserved
    },
    superblock: {
      ...base.superblock,
      username: realUsername,
      email: realEmail,
      role: realRole,
      plan: realPlan,
      loginUrl: base.superblock.loginUrl || "https://app.superblock.chat",
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
 * Enriches missing fields with real customer data already fetched for the selected customer.
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

  try {
    const response = await fetch(
      `/api/credentials?customerId=${encodeURIComponent(customerId)}`,
      { method: "GET", headers }
    );
    if (response.ok) {
      const data = (await response.json().catch(() => null)) as CredentialsResponse | null;
      if (data?.success && data.credentials) {
        return populateCredentialsWithRealData(data.credentials, context);
      }
    }
  } catch (err) {
    console.warn("Credentials fetch failed, returning unconfigured state with customer context:", err);
  }
  return buildUnconfiguredCredentials(customerId, customerName, context);
}
