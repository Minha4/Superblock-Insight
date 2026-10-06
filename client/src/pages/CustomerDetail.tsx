import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowLeft,
  CalendarPlus,
  Check,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Loader2,
  MessageSquarePlus,
  MoreHorizontal,
  PackageOpen,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  Avatar,
  SectionHeader,
  StatusBadge,
  downloadCsv,
} from "@/components/dashboard-ui";
import { CopyButton, QuickFormDialog } from "@/components/ActionDialogs";
import { getCustomerMetadata, type CustomerMetadataRecord } from "@/lib/api/customerMetadata";
import { Button } from "@/components/ui/button";
import {
  getCustomerMeetings,
  createCustomerMeeting,
  updateCustomerMeeting,
  deleteCustomerMeeting,
  type MeetingRecord,
} from "@/lib/api/meetings";
import {
  getCustomerNotes,
  createCustomerNote,
  updateCustomerNote,
  deleteCustomerNote,
  type NoteRecord,
} from "@/lib/api/notes";
import {
  getCustomerInvoices,
  createCustomerInvoice,
  getCustomerSubscriptions,
  type InvoiceRecord,
  type SubscriptionRecord,
} from "@/lib/api/billing";
import {
  getCustomerCredentials,
  type CustomerCredentialsData,
} from "@/lib/api/credentials";
import {
  getCustomerOfferings,
  type CustomerOfferingRecord,
} from "@/lib/api/offerings";
import {
  ShieldCheck,
  Terminal,
  ExternalLink,
  RefreshCw,
  Globe,
  Share2,
  ShoppingBag,
  Smartphone,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  type Activity as CustomerActivity,
  type Customer,
  type Invoice,
  type Note,
  type Offering,
} from "@/types/customer";
import { useCustomerAnalytics, defaultAllCustomers, type ApiCustomerRecord } from "@/lib/api/customerAnalytics";
import { useCustomerProfile, type CustomerProfileData } from "@/lib/api/customerProfile";
import { useUsageMetrics, useBroadcastUsage, type PlatformUsageResponse } from "@/lib/api/usage";
import { fetchAuthSession } from "aws-amplify/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return "—";
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

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

function formatLastActive(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return dateStr;
  }
}


export default function CustomerDetail() {
  const params = useParams<{ id: string }>();
  const { customers: apiCustomers, rawUsers, loading } = useCustomerAnalytics();
  const [tab, setTab] = useState("overview");
  const [offering, setOffering] = useState<Offering | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const rawCustomer = useMemo(() => {
    const list = apiCustomers.length > 0 ? apiCustomers : defaultAllCustomers;
    return (
      list.find(
        (item) =>
          item.id === params.id ||
          item.id.toLowerCase() === params.id?.toLowerCase() ||
          item.company?.toLowerCase() === params.id?.toLowerCase()
      ) ||
      defaultAllCustomers.find(
        (item) =>
          item.id === params.id ||
          item.id.toLowerCase() === params.id?.toLowerCase() ||
          item.company?.toLowerCase() === params.id?.toLowerCase()
      ) ||
      null
    );
  }, [apiCustomers, params.id]);

  const matchingRawUser = useMemo(() => {
    if (!rawCustomer?.id || !rawUsers || rawUsers.length === 0) return null;
    const targetId = rawCustomer.id.toLowerCase();
    const targetName = (rawCustomer.company || "").toLowerCase();
    const targetContact = (rawCustomer.contact?.name || "").toLowerCase();
    const targetEmail = (rawCustomer.contact?.email || "").toLowerCase();
    return (
      rawUsers.find((u) => {
        if (!u) return false;
        const uId = (u.user_id || "").toLowerCase();
        const uName = (u.user_name || "").toLowerCase();
        const uEmail = (u.user_email || u.email || "").toLowerCase();
        const uBiz = (u.business_name || "").toLowerCase();
        return (
          uId === targetId ||
          uName === targetId ||
          (uName && (uName === targetContact || uName === targetName)) ||
          (uBiz && uBiz === targetName) ||
          (targetEmail !== "—" && uEmail && uEmail === targetEmail)
        );
      }) || null
    );
  }, [rawCustomer?.id, rawCustomer?.company, rawCustomer?.contact?.name, rawCustomer?.contact?.email, rawUsers]);

  const { profile } = useCustomerProfile(rawCustomer?.id);
  const { data: usageData } = useUsageMetrics(rawCustomer?.id);
  const { data: broadcastData } = useBroadcastUsage(rawCustomer?.id);

  interface CustomerOperationsPayload {
    activities: CustomerActivity[];
    products: Offering[];
    deals: {
      id: string;
      sourceDealId: string;
      name: string;
      title: string;
      value: number;
      formattedValue: string;
      currency: string;
      probability: number;
      stage: string;
      status: string;
      pipelineName: string;
      owner: string;
      createdDate: string;
      lastActivityDate: string;
    }[];
    tasks: {
      id: string;
      sourceTaskId: string;
      title: string;
      description: string;
      status: string;
      priority: string;
      dueDate: string;
      createdBy: string;
      createdDate: string;
    }[];
    tickets: {
      id: string;
      sourceTicketId: string;
      title: string;
      description: string;
      category: string;
      priority: string;
      status: string;
      createdBy: string;
      createdDate: string;
      replies: {
        id: string;
        userName: string;
        message: string;
        createdAt: string;
      }[];
    }[];
    groups: {
      id: string;
      sourceGroupId: string;
      name: string;
      channels?: string | null;
      totalCount: number;
      createdDate: string;
    }[];
  }

  const [realOperations, setRealOperations] = useState<CustomerOperationsPayload | null>(null);
  const [customerMetadata, setCustomerMetadata] = useState<CustomerMetadataRecord | null>(null);
  const [dbMeetings, setDbMeetings] = useState<MeetingRecord[]>([]);
  const [dbSubscriptions, setDbSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [operationsRefreshKey, setOperationsRefreshKey] = useState(0);

  useEffect(() => {
    const onOperationsUpdated = () => {
      setOperationsRefreshKey((k) => k + 1);
    };
    window.addEventListener("customer-operations-updated", onOperationsUpdated);
    window.addEventListener("customer-meeting-created", onOperationsUpdated);
    window.addEventListener("customer-offering-created", onOperationsUpdated);
    window.addEventListener("customer-invoice-created", onOperationsUpdated);
    return () => {
      window.removeEventListener("customer-operations-updated", onOperationsUpdated);
      window.removeEventListener("customer-meeting-created", onOperationsUpdated);
      window.removeEventListener("customer-offering-created", onOperationsUpdated);
      window.removeEventListener("customer-invoice-created", onOperationsUpdated);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!rawCustomer?.id) {
      setRealOperations(null);
      setCustomerMetadata(null);
      setDbMeetings([]);
      setDbSubscriptions([]);
      return;
    }

    const customerId = rawCustomer.id;
    const customerName = rawCustomer.company || "";

    const fetchOperationsData = async () => {
      try {
        let opsData: any = null;
        try {
          const res = await fetch(
            `/api/customer-operations?customerId=${encodeURIComponent(customerId)}&customerName=${encodeURIComponent(customerName)}&refresh=true&_t=${Date.now()}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data?.success) {
              opsData = data;
            }
          }
        } catch (err) {
          console.warn("Could not fetch customer operations:", err);
        }

        // Fetch official notes using database API / customeranalyticsdashaboard
        let notesData: any[] = [];
        try {
          const notes = await getCustomerNotes(customerId);
          if (Array.isArray(notes)) {
            notesData = notes;
          }
        } catch (notesErr) {
          console.warn("Could not fetch notes from notes API:", notesErr);
        }

        // Fetch persistent metadata from Supabase public.customer_metadata
        try {
          const meta = await getCustomerMetadata(customerId);
          if (!cancelled && meta) {
            setCustomerMetadata(meta);
          }
        } catch (metaErr) {
          console.warn("Could not fetch customer metadata:", metaErr);
        }

        // Fetch real meetings from Supabase public.meetings
        try {
          const meetings = await getCustomerMeetings(customerId);
          if (!cancelled && Array.isArray(meetings)) {
            setDbMeetings(meetings);
          }
        } catch (mErr) {
          console.warn("Could not fetch meetings from meetings API:", mErr);
        }

        // Fetch real subscriptions from Supabase public.subscriptions
        try {
          const subs = await getCustomerSubscriptions(customerId);
          if (!cancelled && Array.isArray(subs)) {
            setDbSubscriptions(subs);
          }
        } catch (sErr) {
          console.warn("Could not fetch subscriptions from billing API:", sErr);
        }

        if (!cancelled) {
          setRealOperations((prev) => ({
            activities: opsData?.activities || prev?.activities || [],
            products: opsData?.products || prev?.products || [],
            deals: opsData?.deals || prev?.deals || [],
            tasks: opsData?.tasks || prev?.tasks || [],
            tickets: opsData?.tickets || prev?.tickets || [],
            groups: opsData?.groups || prev?.groups || [],
            notes: notesData.length > 0 ? notesData : ((opsData as any)?.notes || (prev as any)?.notes || []),
          } as any));
        }
      } catch (err) {
        console.error("Failed to fetch customer operations/notes:", err);
      }
    };

    fetchOperationsData();

    return () => {
      cancelled = true;
    };
  }, [rawCustomer?.id, rawCustomer?.company, operationsRefreshKey]);

  const customer = useMemo(() => {
    if (!rawCustomer) return null;

    let company = rawCustomer.company;
    let contact = { ...rawCustomer.contact };
    let industry = rawCustomer.industry;
    let region = rawCustomer.region;
    let plan = rawCustomer.plan;
    let activatedAt = rawCustomer.activatedAt;
    let lastActivity = rawCustomer.lastActivity;
    let subscription = { ...rawCustomer.subscription };
    let owner = { ...rawCustomer.owner };

    // Resolve real operational usage data from public.usage_metrics and public.users via useUsageMetrics
    // Zero fake multipliers: if no real operational telemetry is recorded, default cleanly to 0
    const liveMessages = usageData?.metricBreakdown?.messages?.totalValue;
    const planQuota = usageData?.planMetrics?.totalConfiguredMessageVolume;
    const profileVol = profile?.message_volume ? parseInt(profile.message_volume, 10) : null;
    const resolvedMessages = liveMessages ?? (planQuota ?? (profileVol && !isNaN(profileVol) ? profileVol : 0));

    let usage = {
      messages: resolvedMessages,
      whatsapp: usageData?.metricBreakdown?.whatsapp?.totalValue ?? resolvedMessages,
      broadcasts: broadcastData?.totalBroadcasts ?? usageData?.metricBreakdown?.broadcasts?.totalValue ?? 0,
      conversations: usageData?.metricBreakdown?.conversations?.totalValue ?? 0,
      email: usageData?.metricBreakdown?.email?.totalValue ?? 0,
      sms: usageData?.metricBreakdown?.sms?.totalValue ?? 0,
      api: usageData?.metricBreakdown?.api_requests?.totalValue ?? usageData?.metricBreakdown?.api?.totalValue ?? 0,
      automations: usageData?.metricBreakdown?.automations?.totalValue ?? 0,
      storage: usageData?.metricBreakdown?.storage?.totalValue ?? 0,
      contacts: usageData?.contactsSummary?.totalContacts ?? (rawCustomer.usage?.contacts || 0),
    };

    if (profile) {
      if (profile.company_name || profile.business_name) {
        company = (profile.company_name || profile.business_name || company).trim();
      }
      if (profile.full_name || profile.user_name) {
        contact.name = (profile.full_name || profile.user_name || contact.name).trim();
      }
      if (profile.email || profile.user_email) {
        contact.email = (profile.email || profile.user_email || contact.email).trim();
      }
      if (profile.phone || profile.company_phone || profile.business_phone) {
        contact.phone = (
          profile.phone ||
          profile.company_phone ||
          profile.business_phone ||
          contact.phone
        ).trim();
      }
      if (profile.industry || profile.company_industry || profile.selected_industry) {
        const ind = (
          profile.industry ||
          profile.company_industry ||
          profile.selected_industry ||
          ""
        ).trim();
        if (ind) {
          industry = ind.charAt(0).toUpperCase() + ind.slice(1);
        }
      }
      if (
        profile.location ||
        profile.company_location ||
        profile.address ||
        profile.company_address
      ) {
        region = (
          profile.location ||
          profile.company_location ||
          profile.address ||
          profile.company_address ||
          region
        ).trim();
      }
      if (profile.plan || profile.user_plan) {
        const p = (profile.plan || profile.user_plan || "").trim();
        if (p) {
          plan = p.charAt(0).toUpperCase() + p.slice(1);
        }
      }
      if (profile.created_at || profile.createdAt || profile.member_since) {
        activatedAt = formatActivatedDate(
          profile.created_at || profile.createdAt || profile.member_since
        );
        subscription.startDate = activatedAt;
      }
      if (profile.last_login || profile.lastLogin || profile.updated_at) {
        lastActivity = formatLastActive(
          profile.last_login || profile.lastLogin || profile.updated_at
        );
      }
      if (profile.message_volume) {
        const vol = parseInt(profile.message_volume, 10);
        if (!isNaN(vol) && vol > 0) {
          usage.messages = vol;
          usage.whatsapp = vol;
        }
      }
      if (profile.role || profile.user_role) {
        owner.name = (profile.role || profile.user_role || owner.name).trim();
        owner.initials = getInitials(owner.name);
      }
    }

    if (customerMetadata) {
      if (customerMetadata.company_name) {
        company = customerMetadata.company_name;
      }
      if (customerMetadata.industry) {
        industry = customerMetadata.industry;
      }
      if (customerMetadata.plan) {
        plan = customerMetadata.plan;
      }
      if (customerMetadata.resolved_owner_name || customerMetadata.owner_id) {
        const resolvedName = customerMetadata.resolved_owner_name || customerMetadata.owner_id!;
        owner.name = resolvedName;
        owner.initials = getInitials(resolvedName);
      }
    }

    let activities: CustomerActivity[] = [];
    let offerings: Offering[] = [];
    let notes: Note[] = [];
    let invoices: Invoice[] = [];

    if (realOperations) {
      // 1. Activities
      if (Array.isArray(realOperations.activities) && realOperations.activities.length > 0) {
        activities = realOperations.activities;
      }

      // 2. Products / Offerings
      if (Array.isArray(realOperations.products) && realOperations.products.length > 0) {
        offerings = realOperations.products;
      }

      // 3. Tasks & Tickets -> Notes
      const taskNotes: Note[] = (realOperations.tasks || []).map((t) => {
        const prio: Note["priority"] =
          t.priority?.toLowerCase() === "high"
            ? "High"
            : t.priority?.toLowerCase() === "low"
            ? "Low"
            : "Medium";
        return {
          id: t.sourceTaskId || t.id,
          title: t.title || "Operational Task",
          content: `Status: ${t.status} · Due: ${t.dueDate}\n${t.description}`,
          category: "Technical",
          priority: prio,
          createdBy: t.createdBy || "SuperBlock Admin",
          createdDate: t.createdDate || "—",
          updatedAt: t.dueDate !== "—" ? t.dueDate : t.createdDate || "—",
        };
      });

      const ticketNotes: Note[] = (realOperations.tickets || []).map((tk) => {
        const prio: Note["priority"] =
          tk.priority?.toLowerCase() === "high"
            ? "High"
            : tk.priority?.toLowerCase() === "low"
            ? "Low"
            : "Medium";
        const repliesText =
          tk.replies && tk.replies.length > 0
            ? "\n\nReplies:\n" +
              tk.replies
                .map((r) => `• ${r.userName} (${r.createdAt}): ${r.message}`)
                .join("\n")
            : "";
        return {
          id: tk.sourceTicketId || tk.id,
          title: `[Support #${tk.sourceTicketId}] ${tk.title}`,
          content: `${tk.description}${repliesText}`,
          category: "Support",
          priority: prio,
          createdBy: tk.createdBy || "Customer",
          createdDate: tk.createdDate || "—",
          updatedAt:
            tk.replies?.[tk.replies.length - 1]?.createdAt || tk.createdDate || "—",
        };
      });

      const dbNotes: Note[] = ((realOperations as any).notes || []).map((n: any) => ({
        id: n.id,
        title: n.title || "Customer Note",
        content: n.content || "",
        category: n.category || "General",
        priority: (n.priority || "Medium") as "Low" | "Medium" | "High",
        createdBy: n.created_by || n.createdBy || "Team Member",
        createdDate: n.created_at
          ? new Date(n.created_at).toLocaleDateString("en-US", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : (n.createdDate || "—"),
        updatedAt: n.updated_at
          ? new Date(n.updated_at).toLocaleDateString("en-US", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : (n.updatedAt || n.createdDate || "—"),
      }));

      const combinedNotes = [...dbNotes, ...taskNotes, ...ticketNotes];
      if (combinedNotes.length > 0) {
        notes = combinedNotes;
      }

      // 4. Deals -> Invoices & Commercial Terms
      if (Array.isArray(realOperations.deals) && realOperations.deals.length > 0) {
        invoices = realOperations.deals.map((deal) => {
          const isWon =
            deal.status?.toLowerCase() === "won" ||
            deal.stage?.toLowerCase() === "won";
          const isLost =
            deal.status?.toLowerCase() === "lost" ||
            deal.stage?.toLowerCase() === "lost";
          const invoiceStatus: Invoice["status"] = isWon
            ? "Paid"
            : isLost
            ? "Cancelled"
            : "Sent";
          const val = deal.value || 0;
          return {
            id: deal.sourceDealId || deal.id,
            date: deal.createdDate || "—",
            dueDate: deal.lastActivityDate || deal.createdDate || "—",
            product: `${deal.title}${deal.pipelineName ? " (" + deal.pipelineName + ")" : ""}`,
            amount: val,
            tax: 0,
            total: val,
            status: invoiceStatus,
            paymentDate: isWon
              ? deal.lastActivityDate || deal.createdDate
              : undefined,
          };
        });

        const wonSum = realOperations.deals
          .filter(
            (d) =>
              d.status?.toLowerCase() === "won" ||
              d.stage?.toLowerCase() === "won"
          )
          .reduce((sum, d) => sum + (d.value || 0), 0);

        const totalSum = realOperations.deals.reduce(
          (sum, d) => sum + (d.value || 0),
          0
        );

        if (wonSum > 0) {
          subscription.contractValue = wonSum;
          subscription.mrr = Math.round(wonSum / 12);
          subscription.paymentStatus = "Current";
          subscription.status = "Active";
        } else if (totalSum > 0) {
          subscription.contractValue = totalSum;
          subscription.mrr = Math.round(totalSum / 12);
          subscription.paymentStatus = "Current";
          subscription.status = "Active";
        }
      } else {
        invoices = [];
      }
    }

    // Incorporate real active subscription data from Supabase public.subscriptions
    const activeSub = dbSubscriptions.length > 0 ? dbSubscriptions[0] : null;
    if (activeSub) {
      if (activeSub.plan_name) plan = activeSub.plan_name;
      if (activeSub.status) subscription.status = activeSub.status;
      if (activeSub.current_period_start) subscription.startDate = activeSub.current_period_start;
      if (activeSub.current_period_end) subscription.renewalDate = activeSub.current_period_end;
      if (activeSub.mrr) {
        const parsedMrr = Number(activeSub.mrr);
        if (!isNaN(parsedMrr) && parsedMrr > 0) {
          subscription.mrr = parsedMrr;
          subscription.contractValue = parsedMrr * 12;
        }
      }
    }

    // Map real meetings from Supabase public.meetings
    const mappedMeetings = dbMeetings.map((m) => {
      let dateStr = "—";
      if (m.meeting_date) {
        try {
          dateStr = new Date(m.meeting_date).toLocaleDateString("en-US", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
        } catch {
          dateStr = String(m.meeting_date);
        }
      }
      return {
        id: m.id,
        title: m.title || "Meeting",
        status: (m.status || "Scheduled") as any,
        date: dateStr,
        rawDate: m.meeting_date || "",
        owner: m.created_by || "Team Member",
        summary: m.description || "Discussion recorded.",
        decisions: "Key details and commitments noted in description.",
        actionItems: [] as string[],
        participants: [m.created_by || "Team"],
        dueDate: dateStr,
        followUp: "—",
      };
    });

    return {
      ...rawCustomer,
      company,
      initials: getInitials(company),
      contact,
      industry,
      region,
      plan,
      activatedAt,
      lastActivity,
      subscription,
      usage,
      owner,
      activities,
      offerings,
      notes,
      invoices,
      meetings: mappedMeetings,
    };
  }, [rawCustomer, profile, realOperations, usageData, customerMetadata, dbMeetings, dbSubscriptions]);

  const exportCustomer = () => {
    if (!customer) return;
    downloadCsv(`${customer.company.toLowerCase().replace(/\s/g, "-")}.csv`, [
      {
        ID: customer.id,
        Company: customer.company,
        Status: customer.status,
        Plan: customer.plan,
        Contacts: customer.usage.contacts || 0,
        MRR: customer.subscription.mrr,
        Messages: customer.usage.messages,
        Health: customer.health.score,
      },
    ]);
    toast.success("Customer profile exported");
  };

  if (loading && !customer) {
    return (
      <AppShell breadcrumbs={["Customers", "Loading..."]}>
        <div className="flex h-[400px] flex-col items-center justify-center gap-3">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading customer details…</p>
        </div>
      </AppShell>
    );
  }

  if (!customer) {
    return (
      <AppShell breadcrumbs={["Customers", "Not Found"]}>
        <div className="panel flex h-[350px] flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="rounded-full bg-muted/60 p-3">
            <UserRound className="size-6 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Customer record not found</h2>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              No matching customer profile was found for identifier{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                {params.id}
              </code>
              .
            </p>
          </div>
          <Link href="/customers">
            <Button size="sm" variant="outline" className="gap-1.5">
              <ArrowLeft className="size-3.5" /> Back to Customers
            </Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumbs={["Customers", customer.company]}>
      <Link
        href="/customers"
        className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to customers
      </Link>
      <div className="customer-hero">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <Avatar
            initials={customer.initials}
            size="lg"
            className="bg-foreground text-background"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.035em]">
                {customer.company}
              </h1>
              <StatusBadge status={customer.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] font-medium text-zinc-900 dark:text-zinc-100">
              <span>ID: {customer.id}</span>
              {customer.industry !== "—" && <span>{customer.industry}</span>}
              {customer.region !== "—" && <span>{customer.region}</span>}
              {customer.industry === "—" && customer.region === "—" && (
                <span>Pending business portfolio configuration</span>
              )}
              <span>Activated {customer.activatedAt}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 [&_.mini-info_span]:text-zinc-700 dark:[&_.mini-info_span]:text-zinc-300 [&_.mini-info_b]:text-zinc-950 dark:[&_.mini-info_b]:text-zinc-50">
              <span className="mini-info">
                <span>Plan</span>
                <b>{customer.plan}</b>
              </span>
              {customer.usage.contacts && customer.usage.contacts > 0 ? (
                <span className="mini-info">
                  <span>CRM Contacts</span>
                  <b>{formatNumber(customer.usage.contacts)}</b>
                </span>
              ) : null}
              {(customer.contact.name !== "—" || customer.contact.email !== "—") && (
                <span className="mini-info">
                  <span>Contact</span>
                  <b>
                    {customer.contact.name !== "—"
                      ? customer.contact.name
                      : customer.contact.email}
                  </b>
                </span>
              )}
              <span className="mini-info">
                <span>Renewal</span>
                <b>{customer.renewal}</b>
              </span>
              <span className="mini-info">
                <span>Last active</span>
                <b>{customer.lastActivity}</b>
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <QuickFormDialog
            type="note"
            customerId={customer.id}
            title="Add note"
            description={`Add internal context for ${customer.company}.`}
            trigger={
              <Button variant="outline" size="sm" className="bg-card">
                <MessageSquarePlus className="size-3.5" />
                Add note
              </Button>
            }
          />
          <QuickFormDialog
            type="meeting"
            customerId={customer.id}
            title="Add meeting"
            description={`Record a new customer meeting for ${customer.company}.`}
            trigger={
              <Button variant="outline" size="sm" className="bg-card">
                <CalendarPlus className="size-3.5" />
                Add meeting
              </Button>
            }
          />
          <QuickFormDialog
            type="customer"
            customerId={customer.id}
            title="Edit customer"
            description={`Update details and configuration for ${customer.company}.`}
            defaultValues={{
              name: customer.company,
              email: customer.contact.email !== "—" ? customer.contact.email : "",
              plan: ["starter", "growth", "advanced", "enterprise"].includes(customer.plan.toLowerCase())
                ? customer.plan
                : "Growth",
              description: customer.industry && customer.industry !== "—" ? customer.industry : "",
              customerId: customer.id,
            }}
            trigger={
              <Button size="sm">
                <Edit3 className="size-3.5" />
                Edit customer
              </Button>
            }
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="size-8 bg-card">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTab("billing")}>
                Manage subscription
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTab("billing")}>
                View invoices
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportCustomer}>
                <Download className="size-3.5" />
                Export customer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-rose-600"
                onClick={() => toast.success("Account access suspended")}
              >
                Suspend account
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-4">
        <div className="overflow-x-auto border-b">
          <TabsList className="h-10 w-max justify-start rounded-none bg-transparent p-0">
            {[
              "overview",
              "usage",
              "offerings",
              "notes",
              "meetings",
              "credentials",
              "billing",
              "activity",
            ].map((item) => (
              <TabsTrigger
                key={item}
                value={item}
                className="h-10 rounded-none border-b-2 border-transparent px-3 text-[12px] capitalize shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                {item}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="overview" className="mt-4">
          <Overview customer={customer} setTab={setTab} usageData={usageData} />
        </TabsContent>
        <TabsContent value="usage" className="mt-4">
          <Usage customer={customer} usageData={usageData} />
        </TabsContent>
        <TabsContent value="offerings" className="mt-4">
          <Offerings customer={customer} onOpen={setOffering} />
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <Notes key={customer.id} customer={customer} />
        </TabsContent>
        <TabsContent value="meetings" className="mt-4">
          <Meetings key={customer.id} customer={customer} />
        </TabsContent>
        <TabsContent value="credentials" className="mt-4">
          <Credentials
            customer={customer}
            rawCustomer={rawCustomer}
            rawUser={matchingRawUser}
            profile={profile}
          />
        </TabsContent>
        <TabsContent value="billing" className="mt-4">
          <Billing customer={customer} onInvoice={setInvoice} />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ActivityTimeline customer={customer} />
        </TabsContent>
      </Tabs>

      <OfferingDrawer
        offering={offering}
        onOpenChange={(open) => !open && setOffering(null)}
      />
      <InvoiceDialog
        invoice={invoice}
        customer={customer}
        onOpenChange={(open) => !open && setInvoice(null)}
      />
    </AppShell>
  );
}

function Overview({
  customer,
  setTab,
  usageData,
}: {
  customer: Customer;
  setTab: (tab: string) => void;
  usageData?: PlatformUsageResponse | null;
}) {
  const healthParts = [
    {
      label: "Payment standing",
      value:
        customer.subscription.paymentStatus === "Current"
          ? 100
          : customer.subscription.paymentStatus === "—"
          ? 0
          : 40,
    },
  ];

  // Helper to compute real historical trend percentage if multiple records exist in usageMetrics
  const computeTrend = (metricName: string) => {
    if (!usageData?.usageMetrics || usageData.usageMetrics.length < 2) return null;
    const records = usageData.usageMetrics
      .filter((r) => r.metric_name === metricName && r.recorded_at && r.metric_value !== null)
      .sort((a, b) => (a.recorded_at || "").localeCompare(b.recorded_at || ""));
    if (records.length < 2) return null;
    const mid = Math.floor(records.length / 2);
    const earlier = records.slice(0, mid).reduce((sum, r) => sum + (Number(r.metric_value) || 0), 0);
    const recent = records.slice(mid).reduce((sum, r) => sum + (Number(r.metric_value) || 0), 0);
    if (earlier <= 0 && recent <= 0) return null;
    if (earlier <= 0) return { text: "+100%", isNegative: false };
    const pct = Math.round(((recent - earlier) / earlier) * 100);
    return {
      text: pct >= 0 ? `+${pct}%` : `${pct}%`,
      isNegative: pct < 0,
    };
  };

  const overviewCards = useMemo(() => {
    const liveMessages = usageData?.metricBreakdown?.messages?.totalValue;
    const planQuota = usageData?.planMetrics?.totalConfiguredMessageVolume;

    const messagesTrend = computeTrend("messages");
    const whatsappTrend = computeTrend("whatsapp");
    const broadcastsTrend = computeTrend("broadcasts");
    const smsTrend = computeTrend("sms");
    const emailTrend = computeTrend("email");
    const conversationsTrend = computeTrend("conversations");

    const getMessagesBadge = (val: number) => {
      if (val <= 0) return { badge: "—", isNegative: false };
      if (messagesTrend) return { badge: messagesTrend.text, isNegative: messagesTrend.isNegative };
      if (liveMessages != null && liveMessages > 0) return { badge: "Verified", isNegative: false };
      if (planQuota) return { badge: "Plan quota", isNegative: false };
      return { badge: "Recorded", isNegative: false };
    };

    const getWhatsAppBadge = (val: number) => {
      if (val <= 0) return { badge: "—", isNegative: false };
      if (whatsappTrend) return { badge: whatsappTrend.text, isNegative: whatsappTrend.isNegative };
      if (usageData?.metricBreakdown?.whatsapp?.totalValue != null) return { badge: "Verified", isNegative: false };
      if (planQuota) return { badge: "Plan quota", isNegative: false };
      return { badge: "Recorded", isNegative: false };
    };

    const getGenericBadge = (val: number, trend: { text: string; isNegative: boolean } | null) => {
      if (val <= 0) return { badge: "—", isNegative: false };
      if (trend) return { badge: trend.text, isNegative: trend.isNegative };
      return { badge: "Recorded", isNegative: false };
    };

    const messagesInfo = getMessagesBadge(customer.usage.messages);
    const whatsappInfo = getWhatsAppBadge(customer.usage.whatsapp);
    const broadcastsInfo = getGenericBadge(customer.usage.broadcasts, broadcastsTrend);
    const smsInfo = getGenericBadge(customer.usage.sms, smsTrend);
    const emailInfo = getGenericBadge(customer.usage.email, emailTrend);
    const conversationsInfo = getGenericBadge(customer.usage.conversations, conversationsTrend);

    return [
      { label: "Total messages", val: customer.usage.messages, ...messagesInfo },
      { label: "WhatsApp", val: customer.usage.whatsapp, ...whatsappInfo },
      { label: "Broadcasts", val: customer.usage.broadcasts, ...broadcastsInfo },
      { label: "SMS", val: customer.usage.sms, ...smsInfo },
      { label: "Email", val: customer.usage.email, ...emailInfo },
      { label: "Conversations", val: customer.usage.conversations, ...conversationsInfo },
    ];
  }, [customer.usage, usageData]);

  // Real historical momentum data from public.usage_metrics (0 fake analyticsSeries)
  const momentumData = useMemo(() => {
    if (!usageData?.usageMetrics || usageData.usageMetrics.length === 0) {
      return [];
    }

    const dateMap = new Map<string, { date: string; usage: number; responses: number }>();
    for (const record of usageData.usageMetrics) {
      if (!record.recorded_at) continue;
      const dateKey = record.recorded_at.slice(0, 10);
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { date: dateKey, usage: 0, responses: 0 });
      }
      const entry = dateMap.get(dateKey)!;
      const val = Number(record.metric_value) || 0;
      if (record.metric_name === "messages" || record.metric_name === "whatsapp") {
        entry.usage += val;
      } else if (record.metric_name === "conversations") {
        entry.responses += val;
      }
    }

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [usageData]);

  return (
    <div className="space-y-4">
      {usageData?.warning && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <span className="font-semibold">Operational Notice:</span> {usageData.warning}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {overviewCards.map(({ label, val, badge, isNegative }) => (
          <div className="metric-card" key={label}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {label}
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div className="font-tabular text-[21px] font-semibold tracking-[-0.035em]">
                {val > 0 ? formatNumber(val) : "0"}
              </div>
              {val > 0 && badge !== "—" ? (
                <span
                  className={cn(
                    "text-[10px] font-semibold",
                    isNegative ? "text-rose-600" : "text-emerald-600"
                  )}
                >
                  {badge}
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="panel p-4">
          <SectionHeader
            title="Usage momentum"
            description={
              momentumData.length > 0
                ? "Cross-channel engagement for the last 30 days"
                : "No historical message activity recorded"
            }
            action={
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => setTab("usage")}
              >
                View usage <ChevronRight className="size-3" />
              </Button>
            }
          />
          {momentumData.length > 0 ? (
            <div className="h-[255px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={momentumData}
                  margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="customerUsage" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0"
                        stopColor="var(--chart-1)"
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="1"
                        stopColor="var(--chart-1)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--chart-grid)"
                  />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  />
                  <RechartsTooltip content={<SimpleTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="usage"
                    name="Messages"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#customerUsage)"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="responses"
                    name="Conversations"
                    stroke="var(--chart-3)"
                    strokeWidth={1.8}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[255px] flex-col items-center justify-center text-center text-muted-foreground">
              <Activity className="mb-2 size-8 opacity-40" />
              <span className="text-xs font-medium">No operational message logs</span>
              <span className="mt-1 max-w-xs text-[11px] text-muted-foreground/70">
                {customer.usage.contacts && customer.usage.contacts > 0
                  ? `${formatNumber(customer.usage.contacts)} CRM contacts provisioned in public.customer_contacts.`
                  : "Message and channel activity will appear once communication events are logged."}
              </span>
            </div>
          )}
        </div>
        <div className="panel p-4">
          <SectionHeader
            title="Customer health"
            description="Operational indicators, not AI predictions"
            action={<StatusBadge status={customer.health.status || customer.status} />}
          />
          {customer.health.score > 0 ? (
            <>
              <div className="flex items-center gap-5 border-b pb-4">
                <div
                  className={cn(
                    "grid size-20 place-items-center rounded-full border-[7px] font-tabular text-2xl font-semibold",
                    customer.health.score >= 75
                      ? "border-emerald-100 text-emerald-700 dark:border-emerald-950 dark:text-emerald-300"
                      : "border-amber-100 text-amber-700"
                  )}
                >
                  {customer.health.score}
                </div>
                <div>
                  <div className="text-sm font-semibold">{customer.health.status}</div>
                  <div className="mt-1 text-[12px] text-muted-foreground">
                    Usage trend: {customer.health.usageTrend}
                  </div>
                  <div className="mt-1 text-[12px] text-muted-foreground">
                    Login frequency: {customer.health.loginFrequency}
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {healthParts.map((part) => (
                  <div key={part.label}>
                    <div className="mb-1 flex justify-between text-[11px]">
                      <span className="text-muted-foreground">{part.label}</span>
                      <span className="font-tabular font-semibold">{part.value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground"
                        style={{ width: `${part.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-[255px] flex-col items-center justify-center text-center text-muted-foreground">
              <div className="grid size-16 place-items-center rounded-full border border-dashed text-sm font-medium">
                —
              </div>
              <div className="mt-3 text-xs font-semibold">Health metrics pending</div>
              <p className="mt-1 max-w-[240px] text-[11px] text-muted-foreground/70">
                Health score calculates automatically once ongoing usage and operational interactions are established.
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Snapshot
          title="Subscription"
          action={() => setTab("billing")}
          rows={[
            ["Current plan", customer.plan || "—"],
            [
              "MRR",
              customer.subscription.mrr > 0
                ? formatCurrency(customer.subscription.mrr)
                : "—",
            ],
            ["Renewal", customer.subscription.renewalDate || "—"],
            ["Payment", customer.subscription.paymentStatus || "—"],
          ]}
        />
        <Snapshot
          title="Offerings"
          action={() => setTab("offerings")}
          rows={
            customer.offerings && customer.offerings.length > 0
              ? customer.offerings.map((item) => [item.name, item.status]).slice(0, 4)
              : [
                  ["Active offerings", "None provisioned"],
                  ["Status", "—"],
                ]
          }
        />
        <Snapshot
          title="Recent context"
          action={() => setTab("notes")}
          rows={[
            [
              "CRM Contacts",
              customer.usage.contacts
                ? formatNumber(customer.usage.contacts)
                : "—",
            ],
            ["Last meeting", customer.meetings?.[0]?.date || "—"],
            ["Open notes", String(customer.notes?.length || 0)],
            ["Next follow-up", customer.meetings?.[0]?.followUp || "—"],
          ]}
        />
      </div>
    </div>
  );
}

function Snapshot({
  title,
  rows,
  action,
}: {
  title: string;
  rows: string[][];
  action: () => void;
}) {
  return (
    <div className="panel p-4">
      <SectionHeader
        title={title}
        action={
          <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={action}>
            Open <ChevronRight className="size-3" />
          </Button>
        }
      />
      <div className="divide-y divide-border/60">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-4 py-2.5 text-[12px]"
          >
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Usage({
  customer,
  usageData,
}: {
  customer: Customer;
  usageData?: PlatformUsageResponse | null;
}) {
  const [range, setRange] = useState("Last 30 days");
  const channels = [
    {
      name: "WhatsApp",
      value: customer.usage.whatsapp,
      color: "var(--whatsapp)",
      detail:
        customer.usage.whatsapp > 0
          ? `${formatNumber(customer.usage.whatsapp)} messages dispatched`
          : "0 messages recorded",
    },
    {
      name: "Email",
      value: customer.usage.email,
      color: "var(--email)",
      detail:
        customer.usage.email > 0
          ? `${formatNumber(customer.usage.email)} emails dispatched`
          : "0 emails recorded",
    },
    {
      name: "SMS",
      value: customer.usage.sms,
      color: "var(--sms)",
      detail:
        customer.usage.sms > 0
          ? `${formatNumber(customer.usage.sms)} SMS dispatched`
          : "0 SMS recorded",
    },
    {
      name: "Broadcast",
      value: customer.usage.broadcasts,
      color: "var(--broadcast)",
      detail:
        customer.usage.broadcasts > 0
          ? `${formatNumber(customer.usage.broadcasts)} campaigns run`
          : "0 campaigns recorded",
    },
  ];

  const channelTrendSeries = useMemo(() => {
    if (!usageData?.usageMetrics || usageData.usageMetrics.length === 0) {
      return [];
    }
    const dateMap = new Map<string, { date: string; whatsapp: number; email: number; sms: number }>();
    for (const record of usageData.usageMetrics) {
      if (!record.recorded_at) continue;
      const d = new Date(record.recorded_at);
      const dateStr = isNaN(d.getTime())
        ? record.recorded_at.slice(0, 10)
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, { date: dateStr, whatsapp: 0, email: 0, sms: 0 });
      }
      const entry = dateMap.get(dateStr)!;
      const val = Number(record.metric_value) || 0;
      const mName = (record.metric_name || "").toLowerCase();
      if (mName.includes("whatsapp") || mName.includes("messages")) {
        entry.whatsapp += val;
      } else if (mName.includes("email")) {
        entry.email += val;
      } else if (mName.includes("sms")) {
        entry.sms += val;
      }
    }
    return Array.from(dateMap.values());
  }, [usageData]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Customer usage</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Detailed product and channel consumption for {customer.company}.
          </p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="h-8 w-[145px] bg-card text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["Last 7 days", "Last 30 days", "This quarter", "This year"].map(
              (item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      {customer.usage.contacts && customer.usage.contacts > 0 ? (
        <div className="panel flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg border bg-muted/40 font-semibold text-primary">
              <UserRound className="size-4" />
            </span>
            <div>
              <div className="text-xs font-semibold">Audience & CRM Contacts</div>
              <div className="text-[11px] text-muted-foreground">
                Verified operational contacts recorded in SuperBlock Analytics Studio (
                <code className="rounded bg-muted px-1 font-mono text-[10px]">
                  public.customer_contacts
                </code>
                ).
              </div>
            </div>
          </div>
          <div className="font-tabular text-xl font-bold tracking-tight">
            {formatNumber(customer.usage.contacts)}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              contacts
            </span>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {channels.map((channel) => (
          <div className="metric-card" key={channel.name}>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span
                className="size-2 rounded-full"
                style={{ background: channel.color }}
              />
              {channel.name}
            </div>
            <div className="mt-3 font-tabular text-2xl font-semibold">
              {formatNumber(channel.value)}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {channel.detail}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <div className="panel p-4">
          <SectionHeader
            title="Channel usage trend"
            description={`${range} · live operational telemetry`}
          />
          {channelTrendSeries.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={channelTrendSeries}
                  margin={{ top: 10, right: 5, left: -22, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--chart-grid)"
                  />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  />
                  <RechartsTooltip content={<SimpleTooltip suffix="" />} />
                  <Area
                    dataKey="whatsapp"
                    name="WhatsApp"
                    type="monotone"
                    stroke="var(--whatsapp)"
                    fill="var(--whatsapp)"
                    fillOpacity={0.08}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    dataKey="email"
                    name="Email"
                    type="monotone"
                    stroke="var(--email)"
                    strokeWidth={1.8}
                    dot={false}
                  />
                  <Line
                    dataKey="sms"
                    name="SMS"
                    type="monotone"
                    stroke="var(--sms)"
                    strokeWidth={1.8}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[300px] flex-col items-center justify-center text-center text-muted-foreground">
              <Activity className="mb-2 size-8 opacity-40" />
              <span className="text-xs font-medium">
                No channel usage telemetry recorded for this timeframe
              </span>
              <p className="mt-1 max-w-xs text-[11px] text-muted-foreground/70">
                Channel time-series analytics will populate as customer broadcasts, conversations, and automated workflows are dispatched.
              </p>
            </div>
          )}
        </div>
        <div className="panel p-4">
          <SectionHeader
            title="Product consumption"
            description="Usage against contracted limits"
          />
          <div className="space-y-4">
            {[
              [
                "Messages",
                customer.usage.messages > 0
                  ? Math.min(100, Math.round((customer.usage.messages / 1250000) * 100))
                  : 0,
                formatNumber(customer.usage.messages),
                "1.25M",
              ],
              [
                "Automation executions",
                customer.usage.automations > 0
                  ? Math.min(100, Math.round((customer.usage.automations / 2500) * 100))
                  : 0,
                formatNumber(customer.usage.automations),
                "2.5K",
              ],
              [
                "API requests",
                customer.usage.api > 0
                  ? Math.min(100, Math.round((customer.usage.api / 2200000) * 100))
                  : 0,
                formatNumber(customer.usage.api),
                "2.2M",
              ],
              [
                "Storage",
                customer.usage.storage > 0
                  ? Math.min(100, Math.round((customer.usage.storage / 100) * 100))
                  : 0,
                `${customer.usage.storage} GB`,
                "100 GB",
              ],
            ].map(([label, percent, value, limit]) => (
              <div key={label as string}>
                <div className="mb-1.5 flex items-center justify-between text-[11px]">
                  <span>{label}</span>
                  <span className="font-tabular text-muted-foreground">
                    {value} / {limit}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      Number(percent) > 80 ? "bg-amber-500" : "bg-primary"
                    )}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="p-4 pb-2">
          <SectionHeader
            title="Usage breakdown"
            description="Channel quality and outcome metrics"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[780px]">
            <thead>
              <tr>
                <th>Channel</th>
                <th className="text-right">Sent</th>
                <th className="text-right">Delivered</th>
                <th className="text-right">Engaged</th>
                <th className="text-right">Failed</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((channel) => (
                <tr key={channel.name}>
                  <td className="font-medium">{channel.name}</td>
                  <td className="text-right font-tabular">
                    {formatNumber(channel.value)}
                  </td>
                  <td className="text-right font-tabular">
                    {channel.value > 0 ? formatNumber(channel.value) : "0"}
                  </td>
                  <td className="text-right font-tabular text-muted-foreground">
                    —
                  </td>
                  <td className="text-right font-tabular text-muted-foreground">
                    —
                  </td>
                  <td>
                    {channel.value > 0 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <TrendingUp className="size-3" /> Recorded
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Offerings({
  customer,
  onOpen,
}: {
  customer: Customer;
  onOpen: (offering: Offering) => void;
}) {
  const [dbOfferings, setDbOfferings] = useState<CustomerOfferingRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOfferings = useCallback(async () => {
    if (!customer?.id) return;
    setLoading(true);
    try {
      const records = await getCustomerOfferings(customer.id);
      if (Array.isArray(records)) {
        setDbOfferings(records);
      }
    } catch (err) {
      console.error("Error fetching offerings:", err);
    } finally {
      setLoading(false);
    }
  }, [customer?.id]);

  useEffect(() => {
    fetchOfferings();
  }, [fetchOfferings]);

  useEffect(() => {
    const handleCreated = (e: any) => {
      if (e?.detail?.customerId === customer.id) {
        fetchOfferings();
      }
    };
    window.addEventListener("customer-offering-created", handleCreated);
    return () => window.removeEventListener("customer-offering-created", handleCreated);
  }, [customer.id, fetchOfferings]);

  // Real database offerings from Supabase public.customer_offerings combined with operational customer_products
  const offerings: Offering[] = useMemo(() => {
    const supabaseOfferings = dbOfferings.map((co) => ({
      id: co.id,
      name: co.offering_name || "Custom Offering",
      description: `Provisioned service for ${customer.company}`,
      status: (co.status as any) || "Active",
      startDate: co.start_date ? new Date(co.start_date).toLocaleDateString() : "Active",
      expiryDate: co.end_date ? new Date(co.end_date).toLocaleDateString() : "Ongoing",
      quantity: "1 unit",
      pricing: "Enterprise",
      notes: "Provisioned via Analytics Studio",
      owner: "SuperBlock Platform",
    }));

    const existingIds = new Set(supabaseOfferings.map((o) => o.id));
    const operationalProducts = (customer.offerings || []).filter((p) => !existingIds.has(p.id));

    return [...supabaseOfferings, ...operationalProducts];
  }, [dbOfferings, customer.company, customer.offerings]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Offerings & Products</h2>
            {loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Products and operational services provisioned for {customer.company}.
          </p>
        </div>
        <QuickFormDialog
          title="Add offering"
          description={`Provision a new service or product offering for ${customer.company}.`}
          type="offering"
          customerId={customer.id}
          trigger={
            <Button size="sm" className="gap-1.5">
              <Plus className="size-3.5" />
              Add offering
            </Button>
          }
        />
      </div>
      {offerings.length === 0 ? (
        <div className="panel flex flex-col items-center justify-center p-12 text-center">
          <PackageOpen className="mb-3 size-8 text-muted-foreground/40" />
          <h3 className="text-sm font-semibold">No offerings provisioned</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            No dedicated product offerings or add-on packages are currently associated with {customer.company}.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {offerings.map((item) => (
            <button
              key={item.id}
              onClick={() => onOpen(item)}
              className="panel group p-4 text-left transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-sm"
            >
              <div className="flex items-start justify-between">
                <span className="grid size-9 place-items-center rounded-lg border bg-muted/35">
                  <PackageSymbol name={item.name} />
                </span>
                <StatusBadge status={item.status} />
              </div>
              <h3 className="mt-4 text-sm font-semibold group-hover:underline">
                {item.name}
              </h3>
              <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-muted-foreground">
                {item.description}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-y-3 border-t pt-3 text-[11px]">
                <div>
                  <span className="block text-muted-foreground">Quantity</span>
                  <b className="mt-0.5 block font-medium">{item.quantity}</b>
                </div>
                <div>
                  <span className="block text-muted-foreground">Pricing</span>
                  <b className="mt-0.5 block font-medium">{item.pricing}</b>
                </div>
                <div>
                  <span className="block text-muted-foreground">Started</span>
                  <b className="mt-0.5 block font-medium">{item.startDate}</b>
                </div>
                <div>
                  <span className="block text-muted-foreground">Owner</span>
                  <b className="mt-0.5 block font-medium">{item.owner}</b>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Notes({ customer }: { customer: Customer }) {
  const [dbNotes, setDbNotes] = useState<NoteRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");

  const fetchNotes = useCallback(async () => {
    if (!customer?.id) return;
    setLoading(true);
    try {
      const records = await getCustomerNotes(customer.id);
      if (Array.isArray(records)) {
        setDbNotes(records);
      }
    } catch (err) {
      console.warn("Could not load real notes from backend:", err);
    } finally {
      setLoading(false);
    }
  }, [customer?.id]);

  useEffect(() => {
    fetchNotes();

    const onNoteUpdated = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail || detail.customerId === customer.id) {
        fetchNotes();
      }
    };
    window.addEventListener("customer-note-created", onNoteUpdated);
    window.addEventListener("customer-operations-updated", onNoteUpdated);

    return () => {
      window.removeEventListener("customer-note-created", onNoteUpdated);
      window.removeEventListener("customer-operations-updated", onNoteUpdated);
    };
  }, [fetchNotes, customer.id]);

  // Only real database notes from Supabase public.customer_notes
  const notes: Note[] = useMemo(() => {
    return dbNotes.map((n) => ({
      id: n.id,
      title: n.title || "Customer Note",
      content: n.content || "",
      category: "General",
      priority: "Medium",
      createdBy: n.created_by || "Team Member",
      createdDate: n.created_at
        ? new Date(n.created_at).toLocaleDateString("en-US", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "—",
      updatedAt: n.updated_at
        ? new Date(n.updated_at).toLocaleDateString("en-US", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : (n.created_at ? new Date(n.created_at).toLocaleDateString("en-US", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }) : "—"),
    }));
  }, [dbNotes]);

  const handleDelete = async (noteId: string) => {
    try {
      await deleteCustomerNote(noteId);
      setDbNotes((prev) => prev.filter((item) => item.id !== noteId));
      toast.success("Note deleted", {
        description: "The note has been removed from the database.",
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("customer-operations-updated", {
            detail: { customerId: customer.id },
          })
        );
      }
      return true;
    } catch (err: any) {
      console.error("Error deleting note:", err);
      toast.error(err?.message || "Failed to delete note");
      return false;
    }
  };

  const handleUpdate = async (noteId: string, title: string, content: string) => {
    try {
      const updatedNoteRecord = await updateCustomerNote(noteId, { title, content });
      setDbNotes((prev) =>
        prev.map((item) =>
          item.id === noteId
            ? {
                ...item,
                title: updatedNoteRecord?.title ?? title,
                content: updatedNoteRecord?.content ?? content,
                updated_at: new Date().toISOString(),
              }
            : item
        )
      );
      toast.success("Note updated", {
        description: "Your note changes have been saved.",
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("customer-operations-updated", {
            detail: { customerId: customer.id, note: updatedNoteRecord },
          })
        );
      }
      return true;
    } catch (err: any) {
      console.error("Error updating note:", err);
      toast.error(err?.message || "Failed to update note");
      return false;
    }
  };

  const filtered = notes.filter(
    (note) =>
      `${note.title} ${note.content}`.toLowerCase().includes(query.toLowerCase()) &&
      (category === "All categories" || note.category === category)
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Internal notes</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Operational context shared across customer-facing teams.
          </p>
        </div>
        <QuickFormDialog
          type="note"
          customerId={customer.id}
          title="Add note"
          description="Document customer context for internal teams."
          trigger={
            <Button size="sm">
              <Plus className="size-3.5" />
              Add note
            </Button>
          }
        />
      </div>
      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-8 text-xs"
              placeholder="Search notes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "All categories",
                "General",
                "Sales",
                "Support",
                "Billing",
                "Technical",
                "Renewal",
                "Important",
              ].map((item) => (
                <SelectItem value={item} key={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <FileText className="mb-2 size-8 opacity-40" />
            <div className="text-xs font-medium">No notes recorded</div>
            <p className="mt-1 max-w-xs text-[11px] text-muted-foreground/70">
              {notes.length === 0
                ? `No internal relationship notes have been created for ${customer.company}.`
                : "No notes matched your search query or filter."}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NoteRow({
  note,
  onDelete,
  onUpdate,
}: {
  note: Note;
  onDelete: (id: string) => Promise<boolean>;
  onUpdate: (id: string, title: string, content: string) => Promise<boolean>;
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title);
  const [editContent, setEditContent] = useState(note.content);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isEditOpen) {
      setEditTitle(note.title);
      setEditContent(note.content);
    }
  }, [isEditOpen, note.title, note.content]);

  const handleEditSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editContent.trim()) {
      toast.error("Note content is required");
      return;
    }
    setIsSaving(true);
    try {
      const ok = await onUpdate(note.id, editTitle, editContent);
      if (ok) {
        setIsEditOpen(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const ok = await onDelete(note.id);
      if (ok) {
        setIsDeleteOpen(false);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 hover:bg-muted/20">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border bg-muted/40">
          <FileText className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-semibold">{note.title}</h3>
            <StatusBadge
              status={
                note.priority === "High"
                  ? "Renewal Due"
                  : note.priority === "Medium"
                  ? "Trial"
                  : "Active"
              }
              dot={false}
            />
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {note.category}
            </span>
          </div>
          <p className="mt-2 max-w-4xl whitespace-pre-wrap text-[12px] leading-5 text-muted-foreground">
            {note.content}
          </p>
          <div className="mt-2 font-mono text-[10px] text-muted-foreground">
            {note.createdBy} · {note.createdDate} · Updated {note.updatedAt}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setIsEditOpen(true)}>
              <Edit3 className="size-3.5" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-rose-600 focus:text-rose-600"
              onSelect={() => setIsDeleteOpen(true)}
            >
              <Trash2 className="size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Edit Note Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Edit note</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update note title and operational context for this customer.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Note title (optional)"
                className="text-xs"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Content</label>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Enter note content..."
                rows={5}
                className="text-xs"
                disabled={isSaving}
                required
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Delete note</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete &ldquo;{note.title || "this note"}&rdquo;? This action cannot be undone and will permanently remove the note from the database.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete note"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Meetings({ customer }: { customer: Customer }) {
  const [dbMeetings, setDbMeetings] = useState<MeetingRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMeetings = useCallback(async () => {
    if (!customer?.id) return;
    setLoading(true);
    try {
      const records = await getCustomerMeetings(customer.id);
      if (Array.isArray(records)) {
        setDbMeetings(records);
      }
    } catch (err) {
      console.warn("Could not load real meetings from backend:", err);
    } finally {
      setLoading(false);
    }
  }, [customer?.id]);

  useEffect(() => {
    fetchMeetings();

    const handleCreated = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail || detail.customerId === customer.id) {
        fetchMeetings();
      }
    };

    window.addEventListener("customer-meeting-created", handleCreated);
    window.addEventListener("customer-operations-updated", handleCreated);

    return () => {
      window.removeEventListener("customer-meeting-created", handleCreated);
      window.removeEventListener("customer-operations-updated", handleCreated);
    };
  }, [fetchMeetings, customer.id]);

  const handleUpdate = async (
    meetingId: string,
    updates: { title?: string; description?: string; meetingDate?: string; status?: string }
  ) => {
    try {
      await updateCustomerMeeting(meetingId, updates);
      setDbMeetings((prev) =>
        prev.map((m) =>
          m.id === meetingId
            ? {
                ...m,
                title: updates.title ?? m.title,
                description: updates.description ?? m.description,
                meeting_date: updates.meetingDate ?? m.meeting_date,
                status: updates.status ?? m.status,
              }
            : m
        )
      );
      toast.success("Meeting updated", {
        description: "Your meeting changes have been saved.",
      });
      fetchMeetings();
      return true;
    } catch (err: any) {
      console.error("Error updating meeting:", err);
      toast.error(err?.message || "Failed to update meeting");
      return false;
    }
  };

  const handleDelete = async (meetingId: string) => {
    try {
      await deleteCustomerMeeting(meetingId);
      setDbMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      toast.success("Meeting deleted", {
        description: "The meeting has been removed from the database.",
      });
      fetchMeetings();
      return true;
    } catch (err: any) {
      console.error("Error deleting meeting:", err);
      toast.error(err?.message || "Failed to delete meeting");
      return false;
    }
  };

  // Only real database meetings from Supabase public.customer_meetings
  const meetings = useMemo(() => {
    return dbMeetings.map((m) => {
      let dateStr = "—";
      if (m.meeting_date) {
        try {
          dateStr = new Date(m.meeting_date).toLocaleDateString("en-US", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
        } catch {
          dateStr = String(m.meeting_date);
        }
      }
      return {
        id: m.id,
        title: m.title || "Meeting",
        status: (m.status || "Scheduled") as any,
        date: dateStr,
        rawDate: m.meeting_date || "",
        owner: m.created_by || "Team Member",
        summary: m.description || "Discussion recorded.",
        decisions: "Key details and commitments noted in description.",
        actionItems: [] as string[],
        participants: [m.created_by || "Team"],
        dueDate: dateStr,
        followUp: "—",
      };
    });
  }, [dbMeetings]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Meeting minutes</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Decisions, follow-ups, and customer commitments over time.
          </p>
        </div>
        <QuickFormDialog
          type="meeting"
          customerId={customer.id}
          title="Add meeting"
          description="Record a meeting and assign follow-up actions."
          trigger={
            <Button size="sm">
              <Plus className="size-3.5" />
              Add meeting
            </Button>
          }
        />
      </div>
      {loading && meetings.length === 0 ? (
        <div className="panel flex items-center justify-center p-8 text-xs text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading meetings…
        </div>
      ) : meetings.length === 0 ? (
        <div className="panel flex flex-col items-center justify-center p-12 text-center">
          <CalendarPlus className="mb-3 size-8 text-muted-foreground/40" />
          <h3 className="text-sm font-semibold">No meetings recorded</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            No meeting minutes or appointments have been logged for {customer.company}.
          </p>
        </div>
      ) : (
        <div className="relative space-y-3 before:absolute before:bottom-6 before:left-[17px] before:top-6 before:w-px before:bg-border">
          {meetings.map((meeting) => (
            <MeetingRow
              key={meeting.id}
              meeting={meeting}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MeetingRow({
  meeting,
  onUpdate,
  onDelete,
}: {
  meeting: any;
  onUpdate: (
    id: string,
    updates: { title?: string; description?: string; meetingDate?: string; status?: string }
  ) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editTitle, setEditTitle] = useState(meeting.title || "");
  const [editSummary, setEditSummary] = useState(meeting.summary || "");
  const [editDate, setEditDate] = useState("");
  const [editStatus, setEditStatus] = useState(meeting.status || "Scheduled");

  useEffect(() => {
    if (isEditOpen) {
      setEditTitle(meeting.title || "");
      setEditSummary(meeting.summary || "");
      setEditStatus(meeting.status || "Scheduled");
      if (meeting.rawDate) {
        setEditDate(meeting.rawDate.split("T")[0]);
      }
    }
  }, [isEditOpen, meeting]);

  const handleEditSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editTitle.trim()) {
      toast.error("Meeting title is required");
      return;
    }
    setIsSaving(true);
    try {
      const ok = await onUpdate(meeting.id, {
        title: editTitle.trim(),
        description: editSummary.trim(),
        meetingDate: editDate || undefined,
        status: editStatus,
      });
      if (ok) setIsEditOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const ok = await onDelete(meeting.id);
      if (ok) setIsDeleteOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative flex gap-4">
      <span className="z-10 mt-5 grid size-9 shrink-0 place-items-center rounded-full border bg-background">
        <CalendarPlus className="size-3.5" />
      </span>
      <div className="panel flex-1 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{meeting.title}</h3>
              <StatusBadge status={meeting.status} />
            </div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              {meeting.date} · Owner {meeting.owner}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setIsEditOpen(true)}>
                <Edit3 className="size-3.5 mr-1.5" />
                Edit meeting
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onUpdate(meeting.id, { status: "Completed" })}
              >
                <Check className="size-3.5 mr-1.5" />
                Mark complete
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-rose-600 focus:text-rose-600"
                onSelect={() => setIsDeleteOpen(true)}
              >
                <Trash2 className="size-3.5 mr-1.5" />
                Delete meeting
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="mt-3 text-[12px] leading-5 text-muted-foreground">
          {meeting.summary}
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          <span>Participants: {meeting.participants.join(", ")}</span>
          <span>Due {meeting.dueDate}</span>
        </div>
      </div>

      {/* Edit Meeting Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Edit meeting</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update meeting title, schedule, status, and minutes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Meeting title"
                className="text-xs"
                disabled={isSaving}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="text-xs"
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select value={editStatus} onValueChange={setEditStatus} disabled={isSaving}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Scheduled">Scheduled</SelectItem>
                    <SelectItem value="Follow-up due">Follow-up due</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Summary & Notes</label>
              <Textarea
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                placeholder="Key decisions and action items..."
                rows={4}
                className="text-xs"
                disabled={isSaving}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Meeting Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Delete meeting</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete this meeting? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
              Delete meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Credentials({
  customer,
  rawCustomer,
  rawUser,
  profile,
}: {
  customer: Customer;
  rawCustomer?: Customer | null;
  rawUser?: ApiCustomerRecord | null;
  profile?: CustomerProfileData | null;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CustomerCredentialsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const res = await getCustomerCredentials(customer.id, customer.company, {
        id: customer.id,
        company: customer.company,
        contact: customer.contact,
        plan: customer.plan,
        owner: customer.owner,
        activatedAt: customer.activatedAt,
        rawUser,
        rawCustomer,
        profile,
      });
      setData(res);
      if (isManualRefresh) {
        toast.success("Credentials refreshed from database");
      }
    } catch (err: any) {
      console.error("Failed to load customer credentials:", err);
      setError(err?.message || "Failed to load credentials");
      if (isManualRefresh) {
        toast.error("Failed to refresh credentials: " + (err?.message || "Unknown error"));
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [
    customer.id,
    customer.company,
    customer.contact,
    customer.plan,
    customer.owner,
    customer.activatedAt,
    rawUser,
    rawCustomer,
    profile,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isVisible = (key: string) => visibleKeys.includes(key);
  const toggleVisibility = (key: string) => {
    setVisibleKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  if (loading) {
    return (
      <div className="panel flex flex-col items-center justify-center p-16 text-center">
        <Loader2 className="mb-3 size-8 animate-spin text-muted-foreground/60" />
        <h3 className="text-sm font-semibold">Loading customer credentials...</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Querying secure system credentials for {customer.company}.
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="panel flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="mb-3 size-8 text-rose-500" />
        <h3 className="text-sm font-semibold">Unable to load credentials</h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          {error || "No credential record found for this customer."}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 gap-2 text-xs"
          onClick={() => loadData(true)}
        >
          <RefreshCw className="size-3.5" />
          Retry loading
        </Button>
      </div>
    );
  }

  const metaConfigured = Boolean(
    data.meta.hasToken && data.meta.businessPhoneNumberId
  );

  const curlTestSnippet = `curl -X POST "${data.meta.whatsappEndpoint || "https://gateway.superblock.chat/sendWhatsappMessage"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "client_user_id": "${data.username || "client_id"}",
    "phone_number_id": "${data.meta.businessPhoneNumberId || ""}",
    "to": "<PHONE_NUMBER>",
    "template": {
      "name": "hello_world",
      "language": { "code": "en_US" }
    }
  }'`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Customer credentials & integrations</h2>
            <StatusBadge status={metaConfigured ? "Active" : (data.status === "Unconfigured" ? "Unconfigured" : "Partial")} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Live operational access keys, Meta WhatsApp Cloud API IDs, and SuperBlock platform accounts.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs self-start sm:self-auto"
          disabled={isRefreshing}
          onClick={() => loadData(true)}
        >
          <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
          Refresh credentials
        </Button>
      </div>

      {/* Security alert */}
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-amber-900 dark:border-amber-950 dark:bg-amber-950/20 dark:text-amber-200">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="text-[11px] leading-5">
          <b>Restricted access info.</b> These credentials grant direct API access to SuperBlock's message delivery infrastructure and customer WhatsApp Business Accounts. Keep tokens masked during screen sharing.
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid gap-4 xl:grid-cols-2">
        {/* Card 1: Meta WhatsApp Cloud API */}
        <div className="panel p-5">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg border bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <Smartphone className="size-4" />
              </span>
              <div>
                <div className="text-sm font-semibold">Meta WhatsApp Cloud API</div>
                <div className="text-[11px] text-muted-foreground">
                  Official WhatsApp Business Platform (WABA)
                </div>
              </div>
            </div>
            <StatusBadge status={metaConfigured ? "Active" : (data.status === "Unconfigured" ? "Unconfigured" : "Partial")} />
          </div>

          <div className="mt-4 divide-y rounded-lg border bg-muted/10">
            <CredentialRow
              label="Phone ID"
              value={data.meta.businessPhoneNumberId || "Not assigned"}
              mono={Boolean(data.meta.businessPhoneNumberId)}
              action={
                data.meta.businessPhoneNumberId ? (
                  <CopyButton value={data.meta.businessPhoneNumberId} />
                ) : null
              }
            />
            <CredentialRow
              label="WABA ID"
              value={data.meta.businessAccountId || "Not assigned"}
              mono={Boolean(data.meta.businessAccountId)}
              action={
                data.meta.businessAccountId ? (
                  <CopyButton value={data.meta.businessAccountId} />
                ) : null
              }
            />
            <CredentialRow
              label="App ID"
              value={data.meta.appId || "Not assigned"}
              mono={Boolean(data.meta.appId)}
              action={data.meta.appId ? <CopyButton value={data.meta.appId} /> : null}
            />
            <CredentialRow
              label="Portfolio ID"
              value={data.meta.businessPortfolioId || "Not assigned"}
              mono={Boolean(data.meta.businessPortfolioId)}
              action={
                data.meta.businessPortfolioId ? (
                  <CopyButton value={data.meta.businessPortfolioId} />
                ) : null
              }
            />
            <CredentialRow
              label="Endpoint"
              value={data.meta.whatsappEndpoint || "https://gateway.superblock.chat/sendWhatsappMessage"}
              mono
              action={
                <CopyButton
                  value={
                    data.meta.whatsappEndpoint ||
                    "https://gateway.superblock.chat/sendWhatsappMessage"
                  }
                />
              }
            />
            <CredentialRow
              label="Graph Token"
              value={
                data.meta.hasToken
                  ? isVisible("meta_token")
                    ? data.meta.graphApiToken || ""
                    : "••••••••••••••••••••••••••••••••••••••••"
                  : "No token configured"
              }
              mono
              action={
                data.meta.hasToken ? (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      title={isVisible("meta_token") ? "Hide token" : "Reveal token"}
                      onClick={() => toggleVisibility("meta_token")}
                    >
                      {isVisible("meta_token") ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </Button>
                    <CopyButton value={data.meta.graphApiToken || ""} />
                  </div>
                ) : null
              }
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Permanent System User Token (Meta Cloud API)</span>
            {data.updatedAt && (
              <span>Updated {new Date(data.updatedAt).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        {/* Card 2: Superblock Platform Access */}
        <div className="panel p-5">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg border bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                <KeyRound className="size-4" />
              </span>
              <div>
                <div className="text-sm font-semibold">Superblock Workspace</div>
                <div className="text-[11px] text-muted-foreground">
                  Internal customer management & portal account
                </div>
              </div>
            </div>
            <StatusBadge status={data.status === "Unconfigured" ? "Unconfigured" : "Active"} />
          </div>

          <div className="mt-4 divide-y rounded-lg border bg-muted/10">
            <CredentialRow
              label="Username"
              value={data.superblock.username}
              action={<CopyButton value={data.superblock.username} />}
            />
            <CredentialRow
              label="Email"
              value={data.superblock.email || "—"}
              action={data.superblock.email ? <CopyButton value={data.superblock.email} /> : null}
            />
            <CredentialRow
              label="Role"
              value={data.superblock.role || "—"}
              action={null}
            />
            <CredentialRow
              label="Plan"
              value={data.superblock.plan || "—"}
              action={null}
            />
            <CredentialRow
              label="Portal"
              value={data.superblock.loginUrl}
              action={
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    title="Open Superblock portal"
                    onClick={() => window.open(data.superblock.loginUrl, "_blank")}
                  >
                    <ExternalLink className="size-3.5" />
                  </Button>
                  <CopyButton value={data.superblock.loginUrl} />
                </div>
              }
            />
          </div>

          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
            Primary administrative credentials for {customer.company} in the SuperBlock platform.
          </p>
        </div>
      </div>

      {/* Connected Channels if any exist */}
      {(data.channels.facebook || data.channels.instagram || data.channels.shopify) && (
        <div className="panel p-5">
          <div className="flex items-center gap-2 border-b pb-3">
            <Share2 className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Connected Social & Commerce Channels</h3>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {data.channels.facebook && (
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold">Facebook Page</div>
                  <StatusBadge status="Active" />
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Page: <span className="text-foreground">{data.channels.facebook.pageName || data.channels.facebook.pageId}</span>
                </div>
              </div>
            )}
            {data.channels.instagram && (
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold">Instagram Business</div>
                  <StatusBadge status="Active" />
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Handle: <span className="text-foreground">@{data.channels.instagram.username}</span>
                </div>
              </div>
            )}
            {data.channels.shopify && (
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold">Shopify Store</div>
                  <StatusBadge status="Active" />
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground truncate">
                  Store: <span className="text-foreground">{data.channels.shopify.apiUrl}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card 3: Developer cURL Dispatch Test */}
      <div className="panel p-5">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="size-4 text-muted-foreground" />
            <div>
              <div className="text-xs font-semibold">API Integration Verification (cURL)</div>
              <div className="text-[10px] text-muted-foreground">
                Run this terminal snippet to verify real-time WhatsApp message dispatch for this customer.
              </div>
            </div>
          </div>
          <CopyButton value={curlTestSnippet} />
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-[11px] font-mono leading-5 text-zinc-200">
          <pre>{metaConfigured ? curlTestSnippet : `# WhatsApp Cloud API not configured yet for ${customer.company}\n# Assign a Business Phone Number ID and Graph API token to enable live dispatch testing`}</pre>
        </div>
      </div>
    </div>
  );
}

function CredentialRow({
  label,
  value,
  action,
  mono,
}: {
  label: string;
  value: string;
  action: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 px-3 py-1.5">
      <span className="w-24 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[11px]",
          mono && "font-mono text-[11px] text-foreground/90"
        )}
        title={value}
      >
        {value}
      </span>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function Billing({
  customer,
  onInvoice,
}: {
  customer: Customer;
  onInvoice: (invoice: Invoice) => void;
}) {
  const [dbInvoices, setDbInvoices] = useState<InvoiceRecord[]>([]);
  const [dbSubscriptions, setDbSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBillingData = useCallback(async () => {
    if (!customer?.id) return;
    setLoading(true);
    try {
      const [invs, subs] = await Promise.all([
        getCustomerInvoices(customer.id).catch(() => []),
        getCustomerSubscriptions(customer.id).catch(() => []),
      ]);
      if (Array.isArray(invs)) setDbInvoices(invs);
      if (Array.isArray(subs)) setDbSubscriptions(subs);
    } catch (err) {
      console.warn("Could not load billing data from backend:", err);
    } finally {
      setLoading(false);
    }
  }, [customer?.id]);

  useEffect(() => {
    fetchBillingData();

    const handleUpdated = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail || detail.customerId === customer.id) {
        fetchBillingData();
      }
    };

    window.addEventListener("customer-invoice-created", handleUpdated);
    window.addEventListener("customer-operations-updated", handleUpdated);

    return () => {
      window.removeEventListener("customer-invoice-created", handleUpdated);
      window.removeEventListener("customer-operations-updated", handleUpdated);
    };
  }, [fetchBillingData, customer.id]);

  const activeSub = dbSubscriptions.length > 0 ? dbSubscriptions[0] : null;
  const currentPlan = activeSub?.plan_name || customer.plan || "Growth";
  const subscriptionStatus = activeSub?.status || customer.subscription.status || "Active";
  const subMrr = activeSub?.mrr
    ? Number(activeSub.mrr)
    : (customer.subscription.mrr > 0 ? customer.subscription.mrr : 0);

  const invoices: Invoice[] = useMemo(() => {
    const list: Invoice[] = [];
    const seenIds = new Set<string>();

    if (Array.isArray(dbInvoices) && dbInvoices.length > 0) {
      for (const inv of dbInvoices) {
        const id = inv.invoice_number || (inv as any).invoiceNumber || inv.id;
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);

        let dateStr = "—";
        const rawDate = inv.issue_date || (inv as any).issueDate || inv.created_at || (inv as any).date;
        if (rawDate) {
          try {
            dateStr = new Date(rawDate).toLocaleDateString("en-US", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });
          } catch {
            dateStr = String(rawDate);
          }
        }

        let dueDateStr = "—";
        const rawDue = inv.due_date || (inv as any).dueDate;
        if (rawDue) {
          try {
            dueDateStr = new Date(rawDue).toLocaleDateString("en-US", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });
          } catch {
            dueDateStr = String(rawDue);
          }
        }

        const amt = Number(inv.amount) || 0;
        const tax = (inv as any).tax !== undefined ? Number((inv as any).tax) : Math.round(amt * 0.18);
        const total = (inv as any).total !== undefined ? Number((inv as any).total) : amt + tax;

        list.push({
          id,
          date: dateStr,
          dueDate: dueDateStr,
          product: inv.description || (inv as any).product || "Growth + WhatsApp API",
          amount: amt,
          tax,
          total,
          status: (inv.status || "Paid") as any,
          paymentDate: inv.paid_date || (inv as any).paymentDate || (inv.status === "Paid" ? dateStr : undefined),
        });
      }
    }

    // Also include any deal invoices from operational PostgreSQL
    if (Array.isArray(customer.invoices) && customer.invoices.length > 0) {
      for (const opInv of customer.invoices) {
        if (!opInv.id || seenIds.has(opInv.id)) continue;
        seenIds.add(opInv.id);
        list.push(opInv);
      }
    }

    return list;
  }, [dbInvoices, customer.invoices]);

  const lifetimeBilled = invoices.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="panel p-4">
          <SectionHeader
            title="Current subscription"
            description="Commercial and renewal terms"
            action={
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => toast.success("Subscription manager opened")}
              >
                Manage subscription
              </Button>
            }
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-foreground p-4 text-background">
              <div className="text-[10px] uppercase tracking-wider opacity-60">
                Current plan
              </div>
              <div className="mt-2 text-xl font-semibold">{currentPlan}</div>
              <div className="mt-4 text-[11px] opacity-70">
                {customer.subscription.billingCycle || "Annual"} billing
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-5 sm:col-span-2">
              {[
                ["Status", subscriptionStatus],
                ["Payment", customer.subscription.paymentStatus || "Current"],
                ["Start date", activeSub?.current_period_start || customer.subscription.startDate || "—"],
                ["Renewal date", activeSub?.current_period_end || customer.subscription.renewalDate || "—"],
                [
                  "MRR",
                  subMrr > 0 ? formatCurrency(subMrr) : "—",
                ],
                [
                  "Contract value",
                  subMrr > 0 ? formatCurrency(subMrr * 12) : (customer.subscription.contractValue > 0 ? formatCurrency(customer.subscription.contractValue) : "—"),
                ],
              ].map(([label, value]) => (
                <div key={label} className="border-b py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {label}
                  </div>
                  <div className="mt-1 text-xs font-medium">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="panel p-4">
          <SectionHeader
            title="Revenue history"
            description="Rolling billed revenue"
          />
          {subMrr > 0 ? (
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={["Apr", "May", "Jun", "Jul", "Aug", "Sep"].map(
                    (month, index) => ({
                      month,
                      revenue: subMrr * (0.82 + index * 0.04),
                    })
                  )}
                  margin={{ top: 8, right: 4, left: -16, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--chart-grid)"
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                    tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                  />
                  <RechartsTooltip content={<SimpleTooltip currency />} />
                  <Bar
                    dataKey="revenue"
                    name="Revenue"
                    fill="var(--chart-1)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[180px] flex-col items-center justify-center text-center text-muted-foreground">
              <span className="text-xs font-medium">No billed revenue</span>
              <span className="mt-1 text-[11px] text-muted-foreground/70">
                Billed transactions will appear once invoices are generated.
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 pb-2">
          <SectionHeader
            title="Invoices"
            description={
              invoices.length > 0
                ? `${invoices.length} invoices · ${formatCurrency(lifetimeBilled)} lifetime billed`
                : "0 invoices · ₹0 billed"
            }
          />
          <div className="flex items-center gap-2">
            <QuickFormDialog
              type="invoice"
              customerId={customer.id}
              defaultValues={{
                customerId: customer.id,
                customerName: customer.company,
                description: "Growth + WhatsApp API",
              }}
              title="Create invoice"
              description="Record a new commercial invoice for this account."
              trigger={
                <Button size="sm" className="h-8 text-xs">
                  <Plus className="mr-1.5 size-3.5" />
                  Add invoice
                </Button>
              }
            />
            {invoices.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 bg-card text-xs"
                onClick={() => toast.success("Invoice export ready")}
              >
                <Download className="mr-1.5 size-3.5" />
                Export
              </Button>
            )}
          </div>
        </div>
        {loading && invoices.length === 0 ? (
          <div className="panel flex items-center justify-center p-8 text-xs text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading invoices…
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No invoices generated for this account.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[820px]">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Due date</th>
                  <th>Product</th>
                  <th className="text-right">Subtotal</th>
                  <th className="text-right">Tax</th>
                  <th className="text-right">Total</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invoices.map((item) => (
                  <tr key={item.id}>
                    <td className="font-mono text-[11px]">{item.id}</td>
                    <td>{item.date}</td>
                    <td>{item.dueDate}</td>
                    <td>{item.product}</td>
                    <td className="text-right font-tabular">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="text-right font-tabular">
                      {formatCurrency(item.tax)}
                    </td>
                    <td className="text-right font-tabular font-medium">
                      {formatCurrency(item.total)}
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => onInvoice(item)}
                      >
                        View <ChevronRight className="size-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityTimeline({ customer }: { customer: Customer }) {
  const [filter, setFilter] = useState("All activity");
  const activities = customer.activities || [];
  const rows =
    filter === "All activity"
      ? activities
      : activities.filter((item) => item.type === filter);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">All activity</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            A chronological record of every customer operation.
          </p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-8 w-[150px] bg-card text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["All activity", "Broadcast", "Login", "Note", "Meeting", "Invoice"].map(
              (item) => (
                <SelectItem value={item} key={item}>
                  {item}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="panel p-4">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <Activity className="mb-2 size-8 opacity-40" />
            <div className="text-xs font-medium">No activity recorded</div>
            <p className="mt-1 max-w-xs text-[11px] text-muted-foreground/70">
              {activities.length === 0
                ? `No event logs or operations recorded yet for ${customer.company}.`
                : `No activity found for category "${filter}".`}
            </p>
          </div>
        ) : (
          <div className="relative before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-border">
            {rows.map((item, index) => (
              <div
                className="relative flex gap-4 pb-5 last:pb-0"
                key={item.id}
              >
                <span
                  className={cn(
                    "z-10 mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border bg-background",
                    index === 0 && "border-primary/50 bg-primary/10"
                  )}
                >
                  <span
                    className={cn(
                      "size-2 rounded-full bg-muted-foreground/40",
                      index === 0 && "bg-primary"
                    )}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xs font-semibold">{item.title}</h3>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {item.type}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {item.detail}
                  </p>
                  <div className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                    {item.time} · {item.actor}
                    {item.channel ? ` · ${item.channel}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OfferingDrawer({
  offering,
  onOpenChange,
}: {
  offering: Offering | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={!!offering} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[470px]">
        <SheetHeader>
          <SheetTitle>{offering?.name}</SheetTitle>
          <SheetDescription>{offering?.description}</SheetDescription>
        </SheetHeader>
        {offering && (
          <div className="mt-6 space-y-5">
            <div className="rounded-xl border bg-muted/25 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Offering status
                </span>
                <StatusBadge status={offering.status} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                {[
                  ["Start date", offering.startDate],
                  ["Expiry date", offering.expiryDate],
                  ["Quantity", offering.quantity],
                  ["Pricing", offering.pricing],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {label}
                    </div>
                    <div className="mt-1 font-medium">{value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Internal notes
              </div>
              <p className="mt-2 text-xs leading-6">{offering.notes}</p>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Assigned owner
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Avatar
                  initials={offering.owner
                    .split(" ")
                    .map((x) => x[0])
                    .join("")}
                  size="sm"
                />
                <span className="text-xs font-medium">{offering.owner}</span>
              </div>
            </div>
            <div className="flex gap-2 border-t pt-5">
              <Button
                className="flex-1"
                onClick={() => toast.success("Offering edit opened")}
              >
                Edit offering
              </Button>
              <Button
                variant="outline"
                className="flex-1 bg-card"
                onClick={() => toast.success("Offering paused")}
              >
                Pause offering
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function generateInvoiceHtml(invoice: Invoice, customer: Customer): string {
  const companyName = customer.company || "Customer";
  const contactName = customer.contact?.name || "Accounts Dept";
  const contactEmail = customer.contact?.email || "";
  const subtotal = Number(invoice.amount) || 0;
  const tax = Number(invoice.tax) || 0;
  const total = Number(invoice.total) || (subtotal + tax);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoice.id} - ${companyName}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px; color: #0f172a; background: #f8fafc; }
    .invoice-card { max-width: 680px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 14px; padding: 40px; background: #fff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 24px; }
    .brand { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.03em; }
    .brand span { color: #2563eb; }
    .invoice-title { text-align: right; }
    .invoice-num { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 4px; font-family: monospace; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-top: 6px; background: #dcfce7; color: #15803d; }
    .badge.pending { background: #fef3c7; color: #b45309; }
    .badge.overdue { background: #fee2e2; color: #b91c1c; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 600; }
    .val { font-size: 13px; font-weight: 500; color: #334155; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 24px; }
    th { text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; }
    td { padding: 14px 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    .text-right { text-align: right; }
    .totals { margin-left: auto; width: 280px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #64748b; }
    .totals-row.grand { font-size: 16px; font-weight: 700; color: #0f172a; border-top: 2px solid #e2e8f0; padding-top: 10px; margin-top: 6px; }
    .footer { margin-top: 36px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8; }
    @media print {
      body { padding: 0; background: #fff; }
      .invoice-card { border: none; box-shadow: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="brand">Super<span>block</span></div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Commercial Tax Invoice</div>
      </div>
      <div class="invoice-title">
        <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600;">Invoice Reference</div>
        <div class="invoice-num">${invoice.id}</div>
        <span class="badge ${invoice.status.toLowerCase()}">${invoice.status}</span>
      </div>
    </div>
    <div class="grid">
      <div>
        <div class="label">Billed To</div>
        <div class="val" style="font-weight: 700; font-size: 14px;">${companyName}</div>
        <div class="val">${contactName}</div>
        ${contactEmail ? `<div class="val">${contactEmail}</div>` : ""}
      </div>
      <div style="text-align: right;">
        <div class="label">Invoice Dates</div>
        <div class="val">Issued: <b>${invoice.date}</b></div>
        <div class="val">Due: <b>${invoice.dueDate}</b></div>
        ${invoice.paymentDate ? `<div class="val">Paid: <b>${invoice.paymentDate}</b></div>` : ""}
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Item / Service</th>
          <th class="text-right">Amount (INR)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div style="font-weight: 600;">${invoice.product || "Platform Subscription & WhatsApp Usage"}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Monthly platform operations & broadcast message traffic</div>
          </td>
          <td class="text-right" style="font-family: monospace;">₹${subtotal.toLocaleString("en-IN")}</td>
        </tr>
      </tbody>
    </table>
    <div class="totals">
      <div class="totals-row">
        <span>Subtotal</span>
        <span style="font-family: monospace;">₹${subtotal.toLocaleString("en-IN")}</span>
      </div>
      <div class="totals-row">
        <span>GST / Tax (18%)</span>
        <span style="font-family: monospace;">₹${tax.toLocaleString("en-IN")}</span>
      </div>
      <div class="totals-row grand">
        <span>Total Payable</span>
        <span style="font-family: monospace;">₹${total.toLocaleString("en-IN")}</span>
      </div>
    </div>
    <div class="footer">
      Thank you for your business. For accounts or payment queries, contact accounts@superblock.chat.
    </div>
  </div>
</body>
</html>`;
}

function InvoiceDialog({
  invoice,
  customer,
  onOpenChange,
}: {
  invoice: Invoice | null;
  customer: Customer;
  onOpenChange: (open: boolean) => void;
}) {
  const handleDownloadPdf = () => {
    if (!invoice) return;
    const html = generateInvoiceHtml(invoice, customer);
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 300);
      toast.success("Print & PDF dialog opened");
    } else {
      toast.error("Pop-up blocked. Please allow pop-ups to download PDF.");
    }
  };

  const handleOpenInvoice = () => {
    if (!invoice) return;
    const html = generateInvoiceHtml(invoice, customer);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    toast.success("Invoice opened in new tab");
  };

  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Invoice {invoice?.id}</DialogTitle>
          <DialogDescription>
            {customer.company} · {invoice?.product}
          </DialogDescription>
        </DialogHeader>
        {invoice && (
          <div>
            <div className="rounded-xl bg-foreground p-5 text-background">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider opacity-60">
                    Total amount
                  </div>
                  <div className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                    {formatCurrency(invoice.total)}
                  </div>
                </div>
                <StatusBadge status={invoice.status} />
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3 text-[11px]">
                <div>
                  <div className="opacity-50">Issued</div>
                  <div className="mt-1 font-medium">{invoice.date}</div>
                </div>
                <div>
                  <div className="opacity-50">Due</div>
                  <div className="mt-1 font-medium">{invoice.dueDate}</div>
                </div>
                <div>
                  <div className="opacity-50">Paid</div>
                  <div className="mt-1 font-medium">
                    {invoice.paymentDate || "—"}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 divide-y rounded-lg border text-xs">
              <div className="flex justify-between p-3">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-tabular">
                  {formatCurrency(invoice.amount)}
                </span>
              </div>
              <div className="flex justify-between p-3">
                <span className="text-muted-foreground">Tax (18%)</span>
                <span className="font-tabular">{formatCurrency(invoice.tax)}</span>
              </div>
              <div className="flex justify-between p-3 font-semibold">
                <span>Total</span>
                <span className="font-tabular">
                  {formatCurrency(invoice.total)}
                </span>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleDownloadPdf}
              >
                <Download className="mr-1.5 size-4" />
                Download PDF
              </Button>
              <Button
                onClick={handleOpenInvoice}
              >
                Open invoice
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PackageSymbol({ name }: { name: string }) {
  return name.includes("AI") ? (
    <TrendingUp className="size-4" />
  ) : name.includes("Broadcast") ? (
    <MessageSquarePlus className="size-4" />
  ) : (
    <KeyRound className="size-4" />
  );
}

function SimpleTooltip({
  active,
  payload,
  label,
  suffix = "",
  currency = false,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  suffix?: string;
  currency?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover p-2.5 shadow-lg">
      <div className="mb-1 text-[10px] text-muted-foreground">{label}</div>
      {payload.map((item) => (
        <div
          className="flex min-w-[130px] justify-between gap-3 text-[11px]"
          key={item.name}
        >
          <span>{item.name}</span>
          <b className="font-tabular">
            {currency
              ? formatCurrency(item.value)
              : item.value.toLocaleString("en-IN")}
            {suffix}
          </b>
        </div>
      ))}
    </div>
  );
}
