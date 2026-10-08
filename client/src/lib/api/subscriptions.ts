import { customerContactsSummary } from "@/data/customerContactsData";

export interface SubscriptionItem {
  id: string;
  customer: string;
  customerId: string;
  plan: string;
  status: string;
  startDate: string;
  renewalDate: string;
  cycle: string;
  mrr: number;
  amount: number;
  payment: string;
  autoRenewal: boolean;
  createdAt: string;
  updatedAt?: string;
}

const STORAGE_KEY = "analytics_studio_custom_subscriptions";

function loadLocalSubscriptions(): SubscriptionItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (s: any) =>
          s &&
          s.id !== "sub-101" &&
          s.id !== "sub-102" &&
          s.id !== "sub-103"
      );
    }
    return [];
  } catch {
    return [];
  }
}

function saveLocalSubscriptions(items: SubscriptionItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn("Could not save subscriptions to localStorage:", err);
  }
}

export async function getSubscriptions(customerId?: string): Promise<SubscriptionItem[]> {
  try {
    const url = customerId ? `/api/subscriptions?customerId=${encodeURIComponent(customerId)}` : "/api/subscriptions";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeoutId));
    if (res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data?.subscriptions)) {
        const local = loadLocalSubscriptions();
        const mappedFromDb: SubscriptionItem[] = data.subscriptions.map((s: any) => {
          const localMatch = local.find((l) => l.id === s.id || l.customerId === s.customer_id);
          const contactInfo = customerContactsSummary[s.customer_id] || Object.values(customerContactsSummary).find((c) => c.customerId === s.customer_id || c.clientUserId === s.customer_id);
          const isGeneric = (name?: string | null) => !name || name.toLowerCase() === "superblock customer" || name.toLowerCase() === "new customer";
          const resolvedCustomer = !isGeneric(s.customer_name)
            ? s.customer_name
            : (!isGeneric(s.customer)
                ? s.customer
                : (contactInfo?.customerName || (!isGeneric(localMatch?.customer) ? localMatch?.customer : "SuperBlock Customer")));
          const resolvedPlan = s.plan_name || s.plan || localMatch?.plan || "Growth";

          const rawAmount = Number(s.amount) || 0;
          const isAnnual =
            (s.billing_interval || "").toLowerCase().includes("annual") ||
            (s.billing_interval || "").toLowerCase().includes("year");
          const amount = isAnnual ? rawAmount : rawAmount * 12;
          const mrr = isAnnual ? Math.round(rawAmount / 12) : rawAmount;

          return {
            id: s.id || `sub-${Date.now()}`,
            customer: resolvedCustomer,
            customerId: s.customer_id || customerId || "CUS-DEFAULT",
            plan: resolvedPlan,
            status: (s.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1).toLowerCase() : "Active") as SubscriptionItem["status"],
            startDate: s.start_date || new Date().toISOString().split("T")[0],
            renewalDate: s.end_date || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
            cycle: (s.billing_interval ? s.billing_interval.charAt(0).toUpperCase() + s.billing_interval.slice(1).toLowerCase() : (isAnnual ? "Annual" : "Monthly")) as SubscriptionItem["cycle"],
            mrr,
            amount,
            payment: (s.status?.toLowerCase() === "active" ? "Paid" : "Pending") as SubscriptionItem["payment"],
            autoRenewal: true,
            createdAt: s.created_at || new Date().toISOString(),
            updatedAt: s.updated_at || new Date().toISOString(),
          };
        });

        saveLocalSubscriptions(mappedFromDb);
        return customerId ? mappedFromDb.filter((m) => m.customerId === customerId) : mappedFromDb;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch subscriptions from backend, falling back to local storage:", err);
  }

  const local = loadLocalSubscriptions();
  return customerId ? local.filter((m) => m.customerId === customerId) : local;
}

export async function createSubscription(input: Partial<SubscriptionItem>): Promise<SubscriptionItem> {
  let savedSub: SubscriptionItem = {
    id: input.id || `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    customer: input.customer?.trim() || "New Customer",
    customerId: input.customerId?.trim() || `CUS-${Math.floor(10000 + Math.random() * 90000)}`,
    plan: input.plan || "Growth",
    status: input.status || "Active",
    startDate: input.startDate || new Date().toISOString().split("T")[0],
    renewalDate: input.renewalDate || new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
    cycle: input.cycle || "Monthly",
    mrr: input.mrr ?? 2500,
    amount: input.amount ?? ((input.mrr ?? 2500) * 12),
    payment: input.payment || "Paid",
    autoRenewal: input.autoRenewal ?? true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const cycleStr = (savedSub.cycle || "monthly").toLowerCase();
    const normalizedInterval = cycleStr.includes("annual") || cycleStr.includes("year") ? "annual" : (cycleStr.includes("quarter") ? "quarterly" : "monthly");

    const res = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: savedSub.id,
        customerId: savedSub.customerId,
        customer: savedSub.customer,
        customer_name: savedSub.customer,
        plan: savedSub.plan,
        status: savedSub.status.toLowerCase(),
        startDate: savedSub.startDate,
        endDate: savedSub.renewalDate,
        amount: savedSub.mrr,
        billingInterval: normalizedInterval,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.subscription) {
        savedSub = {
          id: data.subscription.id,
          customer: data.subscription.customer_name || data.subscription.customer || savedSub.customer,
          customerId: data.subscription.customer_id || savedSub.customerId,
          plan: data.subscription.plan_name || data.subscription.plan || savedSub.plan,
          status: (data.subscription.status ? data.subscription.status.charAt(0).toUpperCase() + data.subscription.status.slice(1).toLowerCase() : "Active") as SubscriptionItem["status"],
          startDate: data.subscription.start_date || savedSub.startDate,
          renewalDate: data.subscription.end_date || savedSub.renewalDate,
          cycle: (data.subscription.billing_interval ? data.subscription.billing_interval.charAt(0).toUpperCase() + data.subscription.billing_interval.slice(1).toLowerCase() : "Monthly") as SubscriptionItem["cycle"],
          mrr: Number(data.subscription.amount) || savedSub.mrr,
          amount: (Number(data.subscription.amount) || savedSub.mrr) * 12,
          payment: (data.subscription.status?.toLowerCase() === "active" ? "Paid" : "Pending") as SubscriptionItem["payment"],
          autoRenewal: true,
          createdAt: data.subscription.created_at || savedSub.createdAt,
          updatedAt: data.subscription.updated_at || new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    console.warn("Backend POST /api/subscriptions failed, persisting to local storage:", err);
  }

  const existing = loadLocalSubscriptions();
  const updated = [savedSub, ...existing.filter((s) => s.id !== savedSub.id)];
  saveLocalSubscriptions(updated);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("subscriptions-updated", { detail: savedSub }));
  }

  return savedSub;
}

export async function updateSubscription(id: string, updates: Partial<SubscriptionItem>): Promise<SubscriptionItem> {
  const existing = loadLocalSubscriptions();
  const target = existing.find((s) => s.id === id);

  let updatedSub: SubscriptionItem = {
    ...(target || {}),
    id,
    customer: updates.customer || target?.customer || "Customer",
    customerId: updates.customerId || target?.customerId || "CUS-DEFAULT",
    plan: updates.plan || target?.plan || "Growth",
    status: (updates.status || target?.status || "Active") as SubscriptionItem["status"],
    startDate: updates.startDate || target?.startDate || new Date().toISOString().split("T")[0],
    renewalDate: updates.renewalDate || target?.renewalDate || new Date().toISOString().split("T")[0],
    cycle: (updates.cycle || target?.cycle || "Monthly") as SubscriptionItem["cycle"],
    mrr: updates.mrr ?? target?.mrr ?? 0,
    amount: updates.amount ?? target?.amount ?? 0,
    payment: (updates.payment || target?.payment || "Paid") as SubscriptionItem["payment"],
    autoRenewal: updates.autoRenewal ?? target?.autoRenewal ?? true,
    createdAt: target?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const cycleStr = (updates.cycle || "").toLowerCase();
    const normalizedInterval = cycleStr ? (cycleStr.includes("annual") || cycleStr.includes("year") ? "annual" : (cycleStr.includes("quarter") ? "quarterly" : "monthly")) : undefined;

    const res = await fetch(`/api/subscriptions/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: updates.status?.toLowerCase(),
        plan: updates.plan,
        amount: updates.mrr,
        billingInterval: normalizedInterval,
        startDate: updates.startDate,
        endDate: updates.renewalDate,
        customer: updates.customer,
        customer_name: updates.customer,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.subscription) {
        updatedSub = {
          id: data.subscription.id,
          customer: data.subscription.customer_name || updatedSub.customer,
          customerId: data.subscription.customer_id || updatedSub.customerId,
          plan: data.subscription.plan_name || updatedSub.plan,
          status: (data.subscription.status ? data.subscription.status.charAt(0).toUpperCase() + data.subscription.status.slice(1).toLowerCase() : "Active") as SubscriptionItem["status"],
          startDate: data.subscription.start_date || updatedSub.startDate,
          renewalDate: data.subscription.end_date || updatedSub.renewalDate,
          cycle: (data.subscription.billing_interval ? data.subscription.billing_interval.charAt(0).toUpperCase() + data.subscription.billing_interval.slice(1).toLowerCase() : "Monthly") as SubscriptionItem["cycle"],
          mrr: Number(data.subscription.amount) || updatedSub.mrr,
          amount: (Number(data.subscription.amount) || updatedSub.mrr) * 12,
          payment: (data.subscription.status?.toLowerCase() === "active" ? "Paid" : "Pending") as SubscriptionItem["payment"],
          autoRenewal: true,
          createdAt: data.subscription.created_at || updatedSub.createdAt,
          updatedAt: data.subscription.updated_at || new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    console.warn("Backend PUT /api/subscriptions failed, persisting to local storage:", err);
  }

  const updatedList = existing.map((s) => (s.id === id ? updatedSub : s));
  saveLocalSubscriptions(updatedList);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("subscriptions-updated", { detail: updatedSub }));
  }

  return updatedSub;
}

export async function deleteSubscription(id: string): Promise<boolean> {
  try {
    await fetch(`/api/subscriptions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.warn("Backend DELETE /api/subscriptions failed, removing from local storage:", err);
  }

  const existing = loadLocalSubscriptions();
  const updatedList = existing.filter((s) => s.id !== id);
  saveLocalSubscriptions(updatedList);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("subscriptions-updated", { detail: { id } }));
  }

  return true;
}
