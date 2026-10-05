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

const PRODUCTION_DASHBOARD_BASE =
  "https://gateway.superblock.chat/customeranalyticsdashaboard";

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

/**
 * Builds an explicit unconfigured credentials record when a customer does not have
 * credentials configured in the database. Never fabricates fake tokens or accounts.
 */
export function buildUnconfiguredCredentials(
  customerId: string,
  customerName = ""
): CustomerCredentialsData {
  return {
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
}

/**
 * Retrieves real operational customer credentials (Meta WhatsApp, Superblock, Social & E-commerce).
 */
export async function getCustomerCredentials(
  customerId: string,
  customerName = ""
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
        return data.credentials;
      }
    }
  } catch (err) {
    console.warn("Credentials fetch failed, returning unconfigured state:", err);
  }
  return buildUnconfiguredCredentials(customerId, customerName);
}
