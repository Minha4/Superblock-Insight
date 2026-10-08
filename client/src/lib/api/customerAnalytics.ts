import { useState, useEffect, useCallback } from "react";
import { getCurrentUser, fetchAuthSession } from "aws-amplify/auth";
import { type Customer, type CustomerStatus } from "@/types/customer";
import { customerContactsSummary, getCustomerContactCount } from "@/data/customerContactsData";
import { getAllCustomerMetadata, type CustomerMetadataRecord } from "./customerMetadata";
import { getSubscriptions, type SubscriptionItem } from "./subscriptions";

export interface ApiCustomerRecord {
  user_id: string;
  business_account_id?: string | null;
  business_name?: string | null;
  business_phone_number_id?: string | null;
  business_portfolio_id?: string | null;
  created_at?: string | null;
  email?: string | null;
  user_email?: string | null;
  user_name?: string | null;
}

export interface CustomerAnalyticsApiResponse {
  success: boolean;
  count: number;
  users: ApiCustomerRecord[];
}

let cachedResponse: CustomerAnalyticsApiResponse | null = null;
let inFlightPromise: Promise<CustomerAnalyticsApiResponse> | null = null;

/**
 * Formats an ISO or timestamp date string into "12 Mar 2025" style.
 */
function formatActivatedDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Extracts a 2-character initials string from a business name or username.
 */
function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return "—";
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Maps an API user record to the application's Customer shape.
 * Only real fields provided by the API and Analytics Studio are populated.
 * Unavailable fields are mapped strictly to "—" or 0 without inventing fake data.
 */
export function mapApiUserToCustomer(user: ApiCustomerRecord): Customer {
  const companyName = user.business_name?.trim() || user.user_name?.trim() || user.user_id;
  const contactEmail = user.user_email?.trim() || user.email?.trim() || "—";
  const contactName = user.user_name?.trim() || "—";
  const contactPhone = user.business_phone_number_id?.trim() || "—";

  const isProvisioned = Boolean(
    user.business_account_id &&
    user.business_account_id !== "—" &&
    user.business_portfolio_id &&
    user.business_portfolio_id !== "—"
  );

  const contactCount =
    getCustomerContactCount(user.user_id) ||
    (user.user_name ? getCustomerContactCount(user.user_name) : 0);

  return {
    id: user.user_id,
    company: companyName,
    industry: user.business_portfolio_id ? `Portfolio: ${user.business_portfolio_id}` : "—",
    region: user.business_account_id ? `Account: ${user.business_account_id}` : "—",
    initials: getInitials(companyName),
    contact: {
      name: contactName,
      email: contactEmail,
      phone: contactPhone,
    },
    activatedAt: formatActivatedDate(user.created_at),
    status: (isProvisioned ? "Active" : "Trial") as CustomerStatus,
    plan: "—",
    subscription: {
      status: isProvisioned ? "Active" : "—",
      startDate: formatActivatedDate(user.created_at),
      renewalDate: "—",
      billingCycle: "—",
      mrr: 0,
      contractValue: 0,
      paymentStatus: isProvisioned ? "Current" : "—",
    },
    renewal: "—",
    usage: {
      messages: 0,
      broadcasts: 0,
      conversations: 0,
      email: 0,
      sms: 0,
      whatsapp: 0,
      api: 0,
      automations: 0,
      storage: 0,
      contacts: contactCount,
    },
    offerings: [],
    notes: [],
    meetings: [],
    credentials: [],
    invoices: [],
    activities: [],
    health: {
      score: 0,
      status: "—" as any,
      usageTrend: "Stable",
      loginFrequency: "—",
      riskReason: "—",
    },
    owner: {
      name: "—",
      initials: "—",
    },
    lastActivity: "—",
  };
}

/**
 * Real customers directory mapped from Superblock Analytics Studio's public.customer_contacts table.
 * Includes Superblock HQ, SuperBlock, Superblockdemo, Zangos, Spekxo, Adams Properties, etc.
 */
export const realSuperblockCustomers: Customer[] = Object.entries(customerContactsSummary).map(
  ([userId, info]) => {
    const company = info.customerName || info.clientUserId || "SuperBlock Customer";
    const email = info.clientUserId.includes("@")
      ? info.clientUserId
      : `${info.clientUserId.toLowerCase().replace(/[^a-z0-9]+/g, "")}@superblock.chat`;
    const contactCount = info.contactCount || 0;

    return {
      id: userId,
      company,
      industry: `Account: ${info.clientUserId}`,
      region: info.customerId ? `ID: ${info.customerId.slice(0, 8)}` : "ap-south-1",
      initials: getInitials(company),
      contact: {
        name: info.clientUserId || company,
        email,
        phone: "—",
      },
      activatedAt: "—",
      status: "Active" as CustomerStatus,
      plan: "—",
      subscription: {
        status: "—",
        startDate: "—",
        renewalDate: "—",
        billingCycle: "—",
        mrr: 0,
        contractValue: 0,
        paymentStatus: "—",
      },
      renewal: "—",
      usage: {
        messages: 0,
        broadcasts: 0,
        conversations: 0,
        email: 0,
        sms: 0,
        whatsapp: 0,
        api: 0,
        automations: 0,
        storage: 0,
        contacts: contactCount,
      },
      offerings: [],
      notes: [],
      meetings: [],
      credentials: [],
      invoices: [],
      activities: [],
      health: {
        score: 0,
        status: "—" as any,
        usageTrend: "Stable",
        loginFrequency: "—",
        riskReason: "—",
      },
      owner: {
        name: "—",
        initials: "—",
      },
      lastActivity: "—",
    };
  }
);

export const defaultAllCustomers: Customer[] = [...realSuperblockCustomers];

/**
 * Fetches customer analytics data from https://gateway.superblock.chat/customeranalytics
 * with request deduplication, in-memory caching, and graceful fallback.
 */
export async function fetchCustomerAnalytics(forceRefresh = false): Promise<CustomerAnalyticsApiResponse> {
  if (!forceRefresh && cachedResponse) {
    return cachedResponse;
  }
  if (!forceRefresh && inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const session = await fetchAuthSession().catch(() => null);
      const token =
        session?.tokens?.idToken?.toString() ||
        session?.tokens?.accessToken?.toString() ||
        "";

      if (!token) {
        return { success: false, count: 0, users: [] };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      let res: Response;
      try {
        res = await fetch("/api/customeranalytics", {
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
        // Fallback to direct gateway URL if local proxy fails
        res = await fetch("https://gateway.superblock.chat/customeranalytics", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        return { success: false, count: 0, users: [] };
      }

      const data: CustomerAnalyticsApiResponse = await res.json();
      if (data && Array.isArray(data.users) && data.users.length > 0) {
        cachedResponse = data;
        return data;
      }
      return { success: false, count: 0, users: [] };
    } catch {
      return { success: false, count: 0, users: [] };
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

/**
 * Merges live Cognito/API users with the real customer database (defaultAllCustomers).
 * Enriches matching customers with live IDs and auth details while preserving company names,
 * contact counts, offerings, notes, meetings, and credentials.
 * Ensures Superblock HQ, SuperBlock, Superblockdemo, and all real accounts are ALWAYS preserved.
 */
export function mergeCustomersWithRealData(
  apiUsers: ApiCustomerRecord[],
  baseCustomers: Customer[] = defaultAllCustomers
): Customer[] {
  if (!apiUsers || apiUsers.length === 0) {
    return baseCustomers;
  }

  const result = [...baseCustomers];
  const matchedUserIds = new Set<string>();

  for (let i = 0; i < result.length; i++) {
    const cust = result[i];
    const matchingUser = apiUsers.find((u) => {
      if (!u) return false;
      const uId = (u.user_id || "").toLowerCase();
      const uName = (u.user_name || "").toLowerCase();
      const uEmail = (u.user_email || u.email || "").toLowerCase();
      const cId = (cust.id || "").toLowerCase();
      const cComp = (cust.company || "").toLowerCase();
      const cName = (cust.contact?.name || "").toLowerCase();
      const cEmail = (cust.contact?.email || "").toLowerCase();

      return (
        uId === cId ||
        uName === cId ||
        (uName && (uName === cName || uName === cComp)) ||
        (uEmail && (uEmail === cEmail || uEmail === cId)) ||
        (cComp.includes("superblock") &&
          (uEmail.includes("superblock") ||
            uName.includes("superblock") ||
            uId === "91933d4a-3021-70f6-c905-91fea73a42bc"))
      );
    });

    if (matchingUser) {
      matchedUserIds.add(matchingUser.user_id);
      result[i] = {
        ...cust,
        company: matchingUser.business_name?.trim() || cust.company,
        industry: matchingUser.business_portfolio_id
          ? `Portfolio: ${matchingUser.business_portfolio_id}`
          : cust.industry,
        region: matchingUser.business_account_id
          ? `Account: ${matchingUser.business_account_id}`
          : cust.region,
        contact: {
          name: matchingUser.user_name || cust.contact.name,
          email: matchingUser.user_email || matchingUser.email || cust.contact.email,
          phone: matchingUser.business_phone_number_id || cust.contact.phone,
        },
      };
    }
  }

  for (const u of apiUsers) {
    if (!matchedUserIds.has(u.user_id)) {
      result.push(mapApiUserToCustomer(u));
    }
  }

  return result;
}

export function getCustomCustomers(): Customer[] {
  return [];
}

export async function createCustomer(_data: {
  company: string;
  email?: string;
  plan?: string;
  phone?: string;
}): Promise<never> {
  throw new Error(
    "Customer provisioning is managed via Superblock Platform gateway onboarding. Direct customer creation is not supported in Analytics Studio."
  );
}

let cachedMetadata: Record<string, CustomerMetadataRecord> = {};
let cachedSubscriptions: SubscriptionItem[] = [];

/**
 * React hook to access and manage customer data.
 * Merges:
 * 1. Gateway/Cognito live users (ApiCustomerRecord)
 * 2. Static real SuperBlock accounts (defaultAllCustomers)
 * 3. Supabase public.customer_metadata (company, industry, plan, owner, tags)
 * 4. Supabase public.subscriptions (active plans, start/renewal dates, billing cycle, MRR, contract value)
 * 5. Appends DB-only customers (e.g. Femmefit) and any subscription-only accounts.
 */
export function useCustomerAnalytics() {
  const [metadataMap, setMetadataMap] = useState<Record<string, CustomerMetadataRecord>>(() => cachedMetadata);
  const [subscriptionsList, setSubscriptionsList] = useState<SubscriptionItem[]>(() => cachedSubscriptions);

  const getMerged = useCallback(
    (
      apiUsers: ApiCustomerRecord[] = cachedResponse?.users || [],
      metaMap: Record<string, CustomerMetadataRecord> = metadataMap,
      subsList: SubscriptionItem[] = subscriptionsList
    ) => {
      // Index subscriptions: sort by updatedAt/createdAt descending so newer records take precedence
      const sortedSubs = [...subsList].sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      const subByCustId = new Map<string, SubscriptionItem>();
      const subByName = new Map<string, SubscriptionItem>();

      for (const s of sortedSubs) {
        if (s.customerId && !subByCustId.has(s.customerId.toLowerCase())) {
          subByCustId.set(s.customerId.toLowerCase(), s);
        }
        if (s.customer) {
          const norm = s.customer.toLowerCase().trim();
          if (!subByName.has(norm)) {
            subByName.set(norm, s);
          }
        }
      }

      const base = [...defaultAllCustomers];
      const merged = apiUsers && apiUsers.length > 0 ? mergeCustomersWithRealData(apiUsers, base) : base;

      const handledCustomerIds = new Set<string>();
      const handledCompanyNames = new Set<string>();

      // 1. Enrich existing merged customers
      const enrichedCustomers = merged.map((c) => {
        handledCustomerIds.add(c.id.toLowerCase());
        if (c.company) {
          handledCompanyNames.add(c.company.toLowerCase().trim());
        }

        const meta = metaMap[c.id];
        const ownerName = meta ? (meta.resolved_owner_name || meta.owner_id) : undefined;
        const companyName = meta?.company_name || c.company;
        if (companyName) {
          handledCompanyNames.add(companyName.toLowerCase().trim());
        }

        // Match subscription by exact company name or customer ID
        const sub =
          (companyName ? subByName.get(companyName.toLowerCase().trim()) : undefined) ||
          subByCustId.get(c.id.toLowerCase()) ||
          (c.company ? subByName.get(c.company.toLowerCase().trim()) : undefined);

        let updatedCustomer: Customer = {
          ...c,
          company: companyName,
          industry: meta?.industry || c.industry,
          plan: meta?.plan || (sub?.plan && sub.plan !== "—" ? sub.plan : c.plan),
          initials: companyName ? getInitials(companyName) : c.initials,
          owner: ownerName
            ? { name: ownerName, initials: getInitials(ownerName) }
            : c.owner,
        };

        if (sub) {
          const subStatus = sub.status || updatedCustomer.subscription.status;
          const isSubActive = subStatus.toLowerCase().includes("active");
          const isTrial = subStatus.toLowerCase().includes("trial");

          updatedCustomer = {
            ...updatedCustomer,
            status: (isSubActive ? "Active" : isTrial ? "Trial" : updatedCustomer.status) as CustomerStatus,
            renewal: sub.renewalDate && sub.renewalDate !== "—" ? formatActivatedDate(sub.renewalDate) : updatedCustomer.renewal,
            plan: sub.plan && sub.plan !== "—" ? sub.plan : (meta?.plan || updatedCustomer.plan),
            subscription: {
              status: subStatus,
              startDate: sub.startDate && sub.startDate !== "—" ? formatActivatedDate(sub.startDate) : updatedCustomer.subscription.startDate,
              renewalDate: sub.renewalDate && sub.renewalDate !== "—" ? formatActivatedDate(sub.renewalDate) : updatedCustomer.subscription.renewalDate,
              billingCycle: sub.cycle || updatedCustomer.subscription.billingCycle,
              mrr: typeof sub.mrr === "number" && sub.mrr > 0 ? sub.mrr : updatedCustomer.subscription.mrr,
              contractValue: typeof sub.amount === "number" && sub.amount > 0 ? sub.amount : updatedCustomer.subscription.contractValue,
              paymentStatus: sub.payment || (isSubActive ? "Current" : updatedCustomer.subscription.paymentStatus),
            },
          };
        }

        return updatedCustomer;
      });

      const result = [...enrichedCustomers];

      // 2. Append DB-only customers from customer_metadata (e.g. Femmefit)
      for (const [metaId, meta] of Object.entries(metaMap)) {
        const normId = metaId.toLowerCase();
        const normCompany = (meta.company_name || "").toLowerCase().trim();

        if (handledCustomerIds.has(normId) || (normCompany && handledCompanyNames.has(normCompany))) {
          continue;
        }

        const tags = meta.tags || [];
        const getTagValue = (prefix: string) => {
          const tag = tags.find((t) => t.toLowerCase().startsWith(prefix.toLowerCase()));
          if (!tag) return "";
          return tag.slice(prefix.length).trim();
        };

        const contactName = getTagValue("Contact:") || meta.company_name || "New Customer";
        const contactPhone = getTagValue("Phone:") || "—";
        const contactEmail = getTagValue("Email:") || "—";
        const waba = getTagValue("WABA:");

        const sub =
          subByCustId.get(normId) ||
          (normCompany ? subByName.get(normCompany) : undefined);

        const subStatus = sub?.status || (meta.plan?.toLowerCase() === "trial" ? "Trial" : "Active");
        const isSubActive = subStatus.toLowerCase().includes("active");
        const isTrial = subStatus.toLowerCase().includes("trial");

        const subStartDate = sub?.startDate && sub.startDate !== "—"
          ? formatActivatedDate(sub.startDate)
          : formatActivatedDate(meta.created_at);
        const subRenewalDate = sub?.renewalDate && sub.renewalDate !== "—"
          ? formatActivatedDate(sub.renewalDate)
          : "—";
        const subCycle = sub?.cycle || (meta.plan?.toLowerCase().includes("year") ? "Annual" : "Monthly");
        const subMrr = typeof sub?.mrr === "number" ? sub.mrr : 0;
        const subAmount = typeof sub?.amount === "number" ? sub.amount : 0;
        const subPayment = sub?.payment || (isSubActive ? "Current" : isTrial ? "Pending" : "—");

        const ownerName = meta.resolved_owner_name || meta.owner_id;

        // Ensure region is valid and non-dash so it passes the Customers.tsx business accounts filter
        const regionValue = waba
          ? `Account: ${waba.replace(/\s*-\s*Coexistence/i, "").trim()}`
          : (meta.customer_id ? `ID: ${meta.customer_id.slice(0, 8)}` : "ap-south-1");

        const dbCustomer: Customer = {
          id: meta.customer_id,
          company: meta.company_name || "New Customer",
          industry: meta.industry || "General Business",
          region: regionValue,
          initials: getInitials(meta.company_name),
          contact: {
            name: contactName,
            email: contactEmail,
            phone: contactPhone,
          },
          activatedAt: formatActivatedDate(meta.created_at),
          status: (isSubActive ? "Active" : "Trial") as CustomerStatus,
          plan: meta.plan || sub?.plan || "Trial",
          subscription: {
            status: subStatus,
            startDate: subStartDate,
            renewalDate: subRenewalDate,
            billingCycle: subCycle,
            mrr: subMrr,
            contractValue: subAmount,
            paymentStatus: subPayment,
          },
          renewal: subRenewalDate,
          usage: {
            messages: 0,
            broadcasts: 0,
            conversations: 0,
            email: 0,
            sms: 0,
            whatsapp: 0,
            api: 0,
            automations: 0,
            storage: 0,
            contacts: 0,
          },
          offerings: [],
          notes: [],
          meetings: [],
          credentials: [],
          invoices: [],
          activities: [],
          health: {
            score: 85,
            status: "Healthy" as any,
            usageTrend: "Stable",
            loginFrequency: "—",
            riskReason: "—",
          },
          owner: ownerName
            ? { name: ownerName, initials: getInitials(ownerName) }
            : { name: "—", initials: "—" },
          lastActivity: "—",
        };

        handledCustomerIds.add(normId);
        if (normCompany) {
          handledCompanyNames.add(normCompany);
        }
        result.push(dbCustomer);
      }

      // 3. Append any subscription-only customers
      for (const sub of sortedSubs) {
        const normId = (sub.customerId || "").toLowerCase();
        const normComp = (sub.customer || "").toLowerCase().trim();
        if (normId && handledCustomerIds.has(normId)) continue;
        if (normComp && handledCompanyNames.has(normComp)) continue;
        if (!normComp || normComp === "superblock customer" || normComp === "new customer") continue;

        const subStatus = sub.status || "Active";
        const isSubActive = subStatus.toLowerCase().includes("active");
        const subStartDate = sub.startDate && sub.startDate !== "—" ? formatActivatedDate(sub.startDate) : "—";
        const subRenewalDate = sub.renewalDate && sub.renewalDate !== "—" ? formatActivatedDate(sub.renewalDate) : "—";

        const subCustomer: Customer = {
          id: sub.customerId || `sub-cust-${Date.now()}`,
          company: sub.customer,
          industry: "General Business",
          region: sub.customerId ? `ID: ${sub.customerId.slice(0, 8)}` : "ap-south-1",
          initials: getInitials(sub.customer),
          contact: {
            name: sub.customer,
            email: "—",
            phone: "—",
          },
          activatedAt: subStartDate,
          status: (isSubActive ? "Active" : "Trial") as CustomerStatus,
          plan: sub.plan || "Growth",
          subscription: {
            status: subStatus,
            startDate: subStartDate,
            renewalDate: subRenewalDate,
            billingCycle: sub.cycle || "Annual",
            mrr: sub.mrr || 0,
            contractValue: sub.amount || 0,
            paymentStatus: sub.payment || (isSubActive ? "Current" : "Pending"),
          },
          renewal: subRenewalDate,
          usage: {
            messages: 0,
            broadcasts: 0,
            conversations: 0,
            email: 0,
            sms: 0,
            whatsapp: 0,
            api: 0,
            automations: 0,
            storage: 0,
            contacts: 0,
          },
          offerings: [],
          notes: [],
          meetings: [],
          credentials: [],
          invoices: [],
          activities: [],
          health: {
            score: 85,
            status: "Healthy" as any,
            usageTrend: "Stable",
            loginFrequency: "—",
            riskReason: "—",
          },
          owner: { name: "—", initials: "—" },
          lastActivity: "—",
        };

        if (normId) handledCustomerIds.add(normId);
        if (normComp) handledCompanyNames.add(normComp);
        result.push(subCustomer);
      }

      return result;
    },
    [metadataMap, subscriptionsList]
  );

  const [customers, setCustomers] = useState<Customer[]>(() => getMerged());
  const [rawUsers, setRawUsers] = useState<ApiCustomerRecord[]>(() => cachedResponse?.users || []);
  const [loading, setLoading] = useState<boolean>(() => cachedResponse === null && Object.keys(cachedMetadata).length === 0);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      const [data, meta, subs] = await Promise.all([
        fetchCustomerAnalytics(forceRefresh),
        getAllCustomerMetadata(),
        getSubscriptions(),
      ]);
      cachedMetadata = meta;
      cachedSubscriptions = subs;
      setMetadataMap(meta);
      setSubscriptionsList(subs);
      if (data && Array.isArray(data.users) && data.users.length > 0) {
        setRawUsers(data.users);
        setCustomers(getMerged(data.users, meta, subs));
      } else {
        setCustomers(getMerged([], meta, subs));
      }
    } catch (err) {
      setCustomers(getMerged());
    } finally {
      setLoading(false);
    }
  }, [getMerged]);

  useEffect(() => {
    loadData();

    const handleUpdate = async () => {
      try {
        const [meta, subs] = await Promise.all([
          getAllCustomerMetadata(),
          getSubscriptions(),
        ]);
        cachedMetadata = meta;
        cachedSubscriptions = subs;
        setMetadataMap(meta);
        setSubscriptionsList(subs);
        setCustomers(getMerged(cachedResponse?.users || [], meta, subs));
      } catch {
        setCustomers(getMerged());
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("customer-operations-updated", handleUpdate);
      window.addEventListener("subscriptions-updated", handleUpdate);
      return () => {
        window.removeEventListener("customer-operations-updated", handleUpdate);
        window.removeEventListener("subscriptions-updated", handleUpdate);
      };
    }
  }, [loadData, getMerged]);

  return {
    customers,
    rawUsers,
    loading,
    error,
    refresh: () => loadData(true),
  };
}

