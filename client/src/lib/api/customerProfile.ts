import { useState, useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

export interface CustomerProfileData {
  user_id?: string;
  company_name?: string | null;
  business_name?: string | null;
  full_name?: string | null;
  user_name?: string | null;
  email?: string | null;
  user_email?: string | null;
  phone?: string | null;
  company_phone?: string | null;
  business_phone?: string | null;
  industry?: string | null;
  company_industry?: string | null;
  selected_industry?: string | null;
  location?: string | null;
  company_location?: string | null;
  address?: string | null;
  company_address?: string | null;
  country_code?: string | null;
  countryCode?: string | null;
  plan?: string | null;
  user_plan?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  member_since?: string | null;
  last_login?: string | null;
  lastLogin?: string | null;
  updated_at?: string | null;
  profile_picture?: string | null;
  avatar?: string | null;
  avatar_url?: string | null;
  company_logo?: string | null;
  logo?: string | null;
  logo_url?: string | null;
  message_volume?: string | null;
  website?: string | null;
  company_website?: string | null;
  company_size?: string | null;
  team_size?: string | null;
  role?: string | null;
  user_role?: string | null;
}

export interface CustomerProfileApiResponse {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
}

const profileCache = new Map<string, CustomerProfileData>();
const inFlightRequests = new Map<string, Promise<CustomerProfileData | null>>();

/**
 * Strips sensitive tokens, credentials, and secrets in strict compliance with security rules.
 */
function sanitizeProfile(raw: Record<string, any>): CustomerProfileData {
  const sanitized = { ...raw };

  // Explicitly remove credentials, tokens, and endpoints
  delete sanitized.graph_api_token;
  delete sanitized.facebook_access_token;
  delete sanitized.instagram_access_token;
  delete sanitized.shopify_admin_access_token;
  delete sanitized.whatsapp_endpoint;
  delete sanitized.facebook_endpoint;
  delete sanitized.instagram_endpoint;

  return sanitized as CustomerProfileData;
}

/**
 * Fetches per-customer profile and operational metadata from https://gateway.superblock.chat/profile?userId={userId}
 */
export async function fetchCustomerProfile(
  userId: string,
  forceRefresh = false
): Promise<CustomerProfileData | null> {
  if (!userId) return null;

  if (!forceRefresh && profileCache.has(userId)) {
    return profileCache.get(userId) || null;
  }

  if (!forceRefresh && inFlightRequests.has(userId)) {
    return inFlightRequests.get(userId) || null;
  }

  const promise = (async () => {
    try {
      const session = await fetchAuthSession();
      const token =
        session?.tokens?.idToken?.toString() ||
        session?.tokens?.accessToken?.toString() ||
        "";

      if (!token) {
        throw new Error("No active Cognito authentication token found.");
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      let res: Response;
      try {
        res = await fetch(`/api/profile?userId=${encodeURIComponent(userId)}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Proxy returned status ${res.status}`);
        }
      } catch {
        res = await fetch(
          `https://gateway.superblock.chat/profile?userId=${encodeURIComponent(userId)}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          }
        );
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        return null;
      }

      const payload: CustomerProfileApiResponse = await res.json();
      if (!payload.success || !payload.data) {
        return null;
      }

      const returnedId = payload.data.user_id || payload.data.userId;
      // The API returns caller fallback data if a profile does not exist for the queried user.
      // We only accept the profile if the returned ID matches the queried user ID.
      if (returnedId !== userId) {
        return null;
      }

      const cleanData = sanitizeProfile(payload.data);
      profileCache.set(userId, cleanData);
      return cleanData;
    } catch (err) {
      console.warn(`[CustomerProfile] Could not fetch profile for user ${userId}:`, err);
      return null;
    } finally {
      inFlightRequests.delete(userId);
    }
  })();

  inFlightRequests.set(userId, promise);
  return promise;
}

/**
 * React hook to fetch and provide live operational customer profile data.
 */
export function useCustomerProfile(userId?: string) {
  const [profile, setProfile] = useState<CustomerProfileData | null>(() => {
    return userId ? profileCache.get(userId) || null : null;
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    if (profileCache.has(userId)) {
      setProfile(profileCache.get(userId) || null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetchCustomerProfile(userId)
      .then((data) => {
        if (!cancelled) {
          setProfile(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load customer profile");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { profile, loading, error };
}

export async function updateCustomerProfile(
  userId: string,
  overrides: Partial<CustomerProfileData>
): Promise<CustomerProfileData> {
  const current = profileCache.get(userId) || {};
  const updated = { ...current, ...overrides };
  profileCache.set(userId, updated);

  try {
    const res = await fetch(`/api/customers/${encodeURIComponent(userId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(overrides),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data) {
        profileCache.set(userId, data.data);
      }
    }
  } catch (err) {
    console.warn("Could not save profile overrides to server:", err);
  }

  if (typeof window !== "undefined") {
    try {
      const key = `sb_customer_overrides_${userId}`;
      localStorage.setItem(key, JSON.stringify(updated));
      window.dispatchEvent(
        new CustomEvent("customer-operations-updated", {
          detail: { customerId: userId, profile: updated },
        })
      );
    } catch (e) {
      console.error(e);
    }
  }

  return updated;
}

