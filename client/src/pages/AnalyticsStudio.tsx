import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentUser } from "aws-amplify/auth";
import { fetchCustomerAnalytics, useCustomerAnalytics } from "@/lib/api/customerAnalytics";
import { useUsageMetrics } from "@/lib/api/usage";
import { Link } from "wouter";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BarChart3,
  ChevronRight,
  CircleDollarSign,
  MessageCircleMore,
  MoreHorizontal,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  AnalyticsToolbar,
  EmptyState,
  ErrorState,
  KpiCard,
  PageHeader,
  SectionHeader,
  StatusBadge,
  downloadCsv,
} from "@/components/dashboard-ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApp } from "@/contexts/AppContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const metricIcons = [
  UsersRound,
  UsersRound,
  MessageCircleMore,
  CircleDollarSign,
  Activity,
  RefreshCw,
];

const channelColors: Record<string, string> = {
  WhatsApp: "var(--whatsapp)",
  SMS: "var(--sms)",
  Email: "var(--email)",
  Broadcasts: "var(--broadcast)",
};

type ChartState = "data" | "empty" | "error";

function formatCurrency(value: number): string {
  if (!value || isNaN(value)) return "₹0";
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  return `₹${value.toLocaleString("en-IN")}`;
}

function formatNumber(value: number): string {
  if (!value || isNaN(value)) return "0";
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString("en-IN");
}

function getDateCutoffMs(range: string): number {
  const now = Date.now();
  switch (range) {
    case "Today":
      return now - 24 * 60 * 60 * 1000;
    case "Yesterday":
      return now - 48 * 60 * 60 * 1000;
    case "Last 7 days":
      return now - 7 * 24 * 60 * 60 * 1000;
    case "This month": {
      const d = new Date();
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    case "Last month": {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    case "Last 30 days":
    default:
      return now - 30 * 24 * 60 * 60 * 1000;
  }
}

export default function AnalyticsStudio() {
  const { isRefreshing, refreshData } = useApp();
  const { customers, loading: analyticsLoading, refresh: reloadAnalytics } = useCustomerAnalytics();
  const { data: usageData, loading: usageLoading, refresh: reloadUsage } = useUsageMetrics();

  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [subsLoading, setSubsLoading] = useState<boolean>(true);

  const [activities, setActivities] = useState<any[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState<boolean>(true);

  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState<boolean>(true);

  const [dateRange, setDateRange] = useState("Last 30 days");
  const [activityMetrics, setActivityMetrics] = useState(["DAU", "WAU", "MAU"]);
  const [chartState, setChartState] = useState<ChartState>("data");

  const loadSubscriptions = useCallback(async () => {
    setSubsLoading(true);
    try {
      const res = await fetch("/api/subscriptions");
      if (res.ok) {
        const json = await res.json();
        if (json?.success && Array.isArray(json?.subscriptions)) {
          setSubscriptions(json.subscriptions);
        } else {
          setSubscriptions([]);
        }
      } else {
        setSubscriptions([]);
      }
    } catch {
      setSubscriptions([]);
    } finally {
      setSubsLoading(false);
    }
  }, []);

  const loadActivities = useCallback(async () => {
    setActivitiesLoading(true);
    try {
      const res = await fetch("/api/customer-activities");
      if (res.ok) {
        const json = await res.json();
        if (json?.success && Array.isArray(json?.activities)) {
          setActivities(json.activities);
        } else {
          setActivities([]);
        }
      } else {
        setActivities([]);
      }
    } catch {
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  }, []);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const res = await fetch("/api/customer-tickets");
      if (res.ok) {
        const json = await res.json();
        if (json?.success && Array.isArray(json?.tickets)) {
          setTickets(json.tickets);
        } else {
          setTickets([]);
        }
      } else {
        setTickets([]);
      }
    } catch {
      setTickets([]);
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubscriptions();
    loadActivities();
    loadTickets();
  }, [loadSubscriptions, loadActivities, loadTickets]);

  const toggleMetric = (metric: string) =>
    setActivityMetrics((metrics) =>
      metrics.includes(metric)
        ? metrics.filter((item) => item !== metric)
        : [...metrics, metric]
    );

  // 1. TOP KPI CARDS (Preserved real calculation)
  const computedKpis = useMemo(() => {
    const totalCustomers = customers.length;
    const activeCount = customers.filter((c) => c.status === "Active").length;
    const conversionRate =
      totalCustomers > 0
        ? ((activeCount / totalCustomers) * 100).toFixed(1)
        : "0.0";

    const customerDates = customers
      .map((c) => (c.activatedAt && c.activatedAt !== "—" ? new Date(c.activatedAt).getTime() : 0))
      .filter((t) => t > 0)
      .sort((a, b) => a - b);

    let activeCustomerSpark = [0, 0, 0, 0, 0, 0, 0];
    let customerChange = 0;
    if (customerDates.length >= 2) {
      const minDate = customerDates[0];
      const maxDate = customerDates[customerDates.length - 1];
      const step = (maxDate - minDate) / 6;
      if (step > 0) {
        activeCustomerSpark = Array.from({ length: 7 }, (_, i) => {
          const threshold = minDate + step * i;
          return customerDates.filter((t) => t <= threshold).length;
        });
      }
      const now = Date.now();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const recentNew = customerDates.filter((t) => t >= now - thirtyDays).length;
      const priorNew = customerDates.filter(
        (t) => t >= now - thirtyDays * 2 && t < now - thirtyDays
      ).length;
      if (priorNew > 0) {
        customerChange = Number((((recentNew - priorNew) / priorNew) * 100).toFixed(1));
      }
    }

    const metricBreakdown = usageData?.metricBreakdown || {};
    const usageRecords = (usageData?.usageMetrics || []).filter(
      (m) => m.metric_value !== null
    );

    const activeUsageCustomerIds = new Set(
      usageRecords
        .filter((m) => m.customer_id && (Number(m.metric_value) || 0) > 0)
        .map((m) => m.customer_id)
    );
    const recordedActiveUsers = activeUsageCustomerIds.size;
    const breakdownUsers =
      metricBreakdown.active_users?.totalValue ??
      metricBreakdown.users?.totalValue ??
      null;
    const realMau = breakdownUsers !== null ? Number(breakdownUsers) : recordedActiveUsers;

    const deliveredMessages =
      (Number(metricBreakdown.messages?.totalValue) || 0) +
      (Number(metricBreakdown.whatsapp?.totalValue) || 0) +
      (Number(metricBreakdown.broadcasts?.totalValue) || 0);
    const configuredVolume =
      Number(usageData?.planMetrics?.totalConfiguredMessageVolume) || 0;
    const hasDeliveredMessages = deliveredMessages > 0;
    const totalMessages = hasDeliveredMessages ? deliveredMessages : configuredVolume;

    const messageRecords = usageRecords
      .filter((m) => m.metric_name && /message|whatsapp|broadcast/i.test(m.metric_name))
      .sort((a, b) => new Date(a.recorded_at || a.created_at || 0).getTime() - new Date(b.recorded_at || b.created_at || 0).getTime());

    let messageSpark = [0, 0, 0, 0, 0, 0, 0];
    let messageChange = 0;
    if (messageRecords.length >= 2) {
      const vals = messageRecords.slice(-7).map((m) => Number(m.metric_value) || 0);
      messageSpark = vals;
      while (messageSpark.length < 7) {
        messageSpark.unshift(0);
      }
      const now = Date.now();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const recentSum = messageRecords
        .filter((m) => new Date(m.recorded_at || m.created_at || 0).getTime() >= now - thirtyDays)
        .reduce((sum, m) => sum + (Number(m.metric_value) || 0), 0);
      const priorSum = messageRecords
        .filter((m) => {
          const t = new Date(m.recorded_at || m.created_at || 0).getTime();
          return t >= now - thirtyDays * 2 && t < now - thirtyDays;
        })
        .reduce((sum, m) => sum + (Number(m.metric_value) || 0), 0);
      if (priorSum > 0) {
        messageChange = Number((((recentSum - priorSum) / priorSum) * 100).toFixed(1));
      }
    }

    const activeSubs = subscriptions.filter(
      (s) => (s.status || "").toLowerCase() === "active"
    );
    const totalMrr = activeSubs.reduce(
      (sum, s) => sum + (Number(s.amount) || Number(s.mrr) || 0),
      0
    );

    const nowTime = Date.now();
    const in30DaysTime = nowTime + 30 * 24 * 60 * 60 * 1000;
    const renewalsDue = subscriptions.filter((s) => {
      const status = (s.status || "").toLowerCase();
      if (status === "renewal due" || status === "renewal_due") return true;
      const dateStr = s.end_date || s.renewalDate;
      if (!dateStr) return false;
      const d = new Date(dateStr).getTime();
      return !isNaN(d) && d >= nowTime && d <= in30DaysTime;
    }).length;

    let mrrSpark = [0, 0, 0, 0, 0, 0, 0];
    if (activeSubs.length >= 2) {
      const sortedSubs = [...activeSubs].sort(
        (a, b) => new Date(a.created_at || a.start_date || 0).getTime() - new Date(b.created_at || b.start_date || 0).getTime()
      );
      const vals = sortedSubs.slice(-7).map((s) => Number(s.amount) || Number(s.mrr) || 0);
      mrrSpark = vals;
      while (mrrSpark.length < 7) {
        mrrSpark.unshift(0);
      }
    }

    return [
      {
        label: "Monthly active users",
        value: realMau > 0 ? formatNumber(realMau) : "0",
        change: messageChange,
        comparison: realMau > 0 ? "Active telemetry accounts" : "No active telemetry logged",
        spark: messageSpark,
      },
      {
        label: "Active customers",
        value: activeCount > 0 ? formatNumber(activeCount) : "0",
        change: customerChange,
        comparison: `${formatNumber(totalCustomers)} total accounts`,
        spark: activeCustomerSpark,
      },
      {
        label: "Messages sent",
        value: totalMessages > 0 ? formatNumber(totalMessages) : "0",
        change: messageChange,
        comparison: hasDeliveredMessages
          ? "Outbound delivery volume"
          : configuredVolume > 0
          ? "Configured plan volume"
          : "No message volume recorded",
        spark: messageSpark,
      },
      {
        label: "Monthly recurring revenue",
        value: totalMrr > 0 ? formatCurrency(totalMrr) : "₹0",
        change: 0,
        comparison: `${activeSubs.length} active ${activeSubs.length === 1 ? "plan" : "plans"}`,
        spark: mrrSpark,
      },
      {
        label: "Trial conversion",
        value: `${conversionRate}%`,
        change: 0,
        comparison: `${formatNumber(activeCount)} converted of ${formatNumber(totalCustomers)}`,
        spark: activeCustomerSpark,
      },
      {
        label: "Renewals due",
        value: String(renewalsDue),
        change: 0,
        comparison: renewalsDue > 0 ? "Upcoming in 30 days" : "None in next 30 days",
        spark: [0, 0, 0, 0, 0, 0, 0],
      },
    ];
  }, [customers, usageData, subscriptions]);

  // 2. USER ACTIVITY TIME SERIES (DAU / WAU / MAU)
  const userActivityData = useMemo(() => {
    const cutoff = getDateCutoffMs(dateRange);
    const records = (usageData?.usageMetrics || []).filter((m) => {
      if (m.metric_value === null) return false;
      const t = new Date(m.recorded_at || m.created_at || 0).getTime();
      return t >= cutoff;
    });

    if (records.length === 0) return [];

    const dayMap = new Map<string, { customers: Set<string>; valueSum: number }>();
    records.forEach((r) => {
      const d = new Date(r.recorded_at || r.created_at || 0);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (!dayMap.has(key)) {
        dayMap.set(key, { customers: new Set(), valueSum: 0 });
      }
      const entry = dayMap.get(key)!;
      if (r.customer_id) entry.customers.add(r.customer_id);
      entry.valueSum += Number(r.metric_value) || 0;
    });

    let cumulative = 0;
    return Array.from(dayMap.entries()).map(([date, data]) => {
      cumulative += data.customers.size;
      return {
        date,
        dau: data.customers.size || data.valueSum,
        wau: Math.min(cumulative, (data.customers.size || data.valueSum) * 3),
        mau: cumulative || data.valueSum,
      };
    });
  }, [usageData, dateRange]);

  const activityStats = useMemo(() => {
    if (userActivityData.length === 0) {
      return { dau: 0, wau: 0, mau: 0 };
    }
    const latest = userActivityData[userActivityData.length - 1];
    return {
      dau: latest.dau,
      wau: latest.wau,
      mau: latest.mau,
    };
  }, [userActivityData]);

  // 3. COMMUNICATION VOLUME TIME SERIES & TOP CHANNEL CALLOUT
  const communicationVolumeData = useMemo(() => {
    const cutoff = getDateCutoffMs(dateRange);
    const records = (usageData?.usageMetrics || []).filter((m) => {
      if (m.metric_value === null) return false;
      const t = new Date(m.recorded_at || m.created_at || 0).getTime();
      return t >= cutoff;
    });

    if (records.length === 0) return [];

    const dayMap = new Map<string, { whatsapp: number; email: number; sms: number; broadcasts: number }>();
    records.forEach((r) => {
      const d = new Date(r.recorded_at || r.created_at || 0);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (!dayMap.has(key)) {
        dayMap.set(key, { whatsapp: 0, email: 0, sms: 0, broadcasts: 0 });
      }
      const entry = dayMap.get(key)!;
      const name = (r.metric_name || "").toLowerCase();
      const val = Number(r.metric_value) || 0;
      if (name.includes("whatsapp")) entry.whatsapp += val;
      else if (name.includes("email")) entry.email += val;
      else if (name.includes("sms")) entry.sms += val;
      else if (name.includes("broadcast")) entry.broadcasts += val;
      else entry.whatsapp += val;
    });

    return Array.from(dayMap.entries()).map(([date, channels]) => ({
      date,
      ...channels,
    }));
  }, [usageData, dateRange]);

  const channelBreakdown = useMemo(() => {
    const mb = usageData?.metricBreakdown || {};
    const whatsapp = Number(mb.whatsapp?.totalValue) || 0;
    const email = Number(mb.email?.totalValue) || 0;
    const sms = Number(mb.sms?.totalValue) || 0;
    const broadcasts = Number(mb.broadcasts?.totalValue) || 0;

    const list = [
      { name: "WhatsApp", volume: whatsapp },
      { name: "Email", volume: email },
      { name: "SMS", volume: sms },
      { name: "Broadcasts", volume: broadcasts },
    ].sort((a, b) => b.volume - a.volume);

    const total = whatsapp + email + sms + broadcasts;
    const top = list[0];
    const topPct = total > 0 ? ((top.volume / total) * 100).toFixed(1) : "0.0";

    return {
      whatsapp,
      email,
      sms,
      broadcasts,
      total,
      topChannelName: top.volume > 0 ? top.name : "None",
      topChannelShare: topPct,
      topChannelVolume: top.volume,
    };
  }, [usageData]);

  // 4. CONVERSATIONS BREAKDOWN
  const conversationStats = useMemo(() => {
    const rawConversations = Number(usageData?.metricBreakdown?.conversations?.totalValue) || 0;

    const newTickets = tickets.filter((t) => {
      const s = (t.status || "").toLowerCase();
      return s === "new" || s === "open" || s === "unassigned";
    }).length;

    const activeTickets = tickets.filter((t) => {
      const s = (t.status || "").toLowerCase();
      return s === "active" || s === "in_progress" || s === "in progress" || s === "pending";
    }).length;

    const resolvedTickets = tickets.filter((t) => {
      const s = (t.status || "").toLowerCase();
      return s === "resolved" || s === "closed";
    }).length;

    const escalatedTickets = tickets.filter((t) => {
      const s = (t.status || "").toLowerCase();
      return s === "escalated" || s === "urgent";
    }).length;

    const ticketSum = newTickets + activeTickets + resolvedTickets + escalatedTickets;
    const total = Math.max(rawConversations, ticketSum);

    const series = [
      { name: "New", value: newTickets, color: "var(--chart-1)" },
      { name: "Active", value: activeTickets, color: "var(--chart-2)" },
      { name: "Resolved", value: resolvedTickets, color: "var(--chart-3)" },
      { name: "Escalated", value: escalatedTickets, color: "var(--chart-5)" },
    ];

    return { total, series };
  }, [usageData, tickets]);

  // 5. CUSTOMER GROWTH COHORT TIME SERIES
  const customerGrowthData = useMemo(() => {
    const dates = customers
      .map((c) => (c.activatedAt && c.activatedAt !== "—" ? new Date(c.activatedAt).getTime() : 0))
      .filter((t) => t > 0)
      .sort((a, b) => a - b);

    if (dates.length < 2) return [];

    const min = dates[0];
    const max = dates[dates.length - 1];
    const step = (max - min) / 6;
    if (step <= 0) return [];

    return Array.from({ length: 7 }, (_, i) => {
      const bucketEnd = min + step * (i + 1);
      const bucketStart = min + step * i;
      // "New" is directly supported by user registration created_at timestamps
      const newInBucket = dates.filter((t) => t >= bucketStart && t < bucketEnd).length;

      const dateLabel = new Date(bucketEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return {
        date: dateLabel,
        new: newInBucket,
        // "Activated", "Churned", and "Renewed" are not directly supported by the existing database/API fields.
        // The database does not record activation event timestamps, historical churn logs, or renewal events.
        // Set to honest 0 rather than guessing or deriving from creation or update timestamps.
        activated: 0,
        churned: 0,
        renewed: 0,
      };
    });
  }, [customers]);

  const growthStatus = useMemo(() => {
    const active = customers.filter((c) => c.status === "Active").length;
    const churned = subscriptions.filter((s) => {
      const st = (s.status || "").toLowerCase();
      return st === "cancelled" || st === "expired";
    }).length;
    if (active === 0) return "Trial";
    if (churned > active * 0.2) return "At Risk";
    return "Healthy";
  }, [customers, subscriptions]);

  // 6. TOP CUSTOMERS BY REAL USAGE & SUBSCRIPTIONS
  const enrichedTopCustomers = useMemo(() => {
    const planCustomerMap = new Map<string, number>();
    (usageData?.planMetrics?.customers || []).forEach((p) => {
      if (p.userId) planCustomerMap.set(p.userId.toLowerCase(), Number(p.messageVolume) || 0);
      if (p.userName) planCustomerMap.set(p.userName.toLowerCase(), Number(p.messageVolume) || 0);
    });

    const telemetryUsageMap = new Map<string, { messages: number; broadcasts: number; conversations: number; other: number }>();
    (usageData?.usageMetrics || []).forEach((m) => {
      if (!m.customer_id) return;
      const cid = m.customer_id.toLowerCase();
      if (!telemetryUsageMap.has(cid)) {
        telemetryUsageMap.set(cid, { messages: 0, broadcasts: 0, conversations: 0, other: 0 });
      }
      const entry = telemetryUsageMap.get(cid)!;
      const name = (m.metric_name || "").toLowerCase();
      const val = Number(m.metric_value) || 0;
      if (name.includes("message") || name.includes("whatsapp")) entry.messages += val;
      else if (name.includes("broadcast")) entry.broadcasts += val;
      else if (name.includes("conversation")) entry.conversations += val;
      else entry.other += val;
    });

    const subMrrMap = new Map<string, number>();
    subscriptions.forEach((s) => {
      const amt = Number(s.amount) || Number(s.mrr) || 0;
      if (s.customer_id) subMrrMap.set(s.customer_id.toLowerCase(), (subMrrMap.get(s.customer_id.toLowerCase()) || 0) + amt);
      if (s.customer_name) subMrrMap.set(s.customer_name.toLowerCase(), (subMrrMap.get(s.customer_name.toLowerCase()) || 0) + amt);
      if (s.customer) subMrrMap.set(s.customer.toLowerCase(), (subMrrMap.get(s.customer.toLowerCase()) || 0) + amt);
    });

    return [...customers]
      .map((c) => {
        const cid = c.id.toLowerCase();
        const cname = c.company.toLowerCase();
        const planVol = planCustomerMap.get(cid) || planCustomerMap.get(cname) || 0;
        const tel = telemetryUsageMap.get(cid) || telemetryUsageMap.get(cname) || {
          messages: 0,
          broadcasts: 0,
          conversations: 0,
          other: 0,
        };
        const mrr = subMrrMap.get(cid) || subMrrMap.get(cname) || (c.subscription?.mrr || 0);

        const messages = tel.messages > 0 ? tel.messages : planVol;
        const broadcasts = tel.broadcasts;
        const conversations = tel.conversations;
        const totalUsage = messages + broadcasts + conversations + tel.other;

        return {
          ...c,
          realUsage: {
            messages,
            broadcasts,
            conversations,
            totalUsage,
          },
          realMrr: mrr,
        };
      })
      .sort((a, b) => b.realUsage.totalUsage - a.realUsage.totalUsage)
      .slice(0, 6);
  }, [customers, usageData, subscriptions]);

  // 7. RECENT OPERATIONAL ACTIVITIES FILTERED BY DATE RANGE
  const filteredActivities = useMemo(() => {
    const cutoff = getDateCutoffMs(dateRange);
    return activities.filter((a) => {
      const d = a.created_at || a.activity_date;
      if (!d) return true;
      return new Date(d).getTime() >= cutoff;
    });
  }, [activities, dateRange]);

  const isLoading =
    isRefreshing ||
    analyticsLoading ||
    usageLoading ||
    subsLoading ||
    activitiesLoading ||
    ticketsLoading;

  const handleRefresh = async () => {
    try {
      await Promise.all([
        reloadAnalytics(),
        reloadUsage(),
        loadSubscriptions(),
        loadActivities(),
        loadTickets(),
      ]);
      refreshData();
      toast.success("Refreshing analytics data");
    } catch {
      toast.error("Failed to refresh analytics");
    }
  };

  const exportReport = () => {
    downloadCsv(
      "superblock-analytics.csv",
      enrichedTopCustomers.map((customer) => ({
        Customer: customer.company,
        Messages: customer.realUsage.messages,
        Broadcasts: customer.realUsage.broadcasts,
        Conversations: customer.realUsage.conversations,
        "Total Usage": customer.realUsage.totalUsage,
        Revenue: customer.realMrr,
      }))
    );
    toast.success("Analytics exported", {
      description: "The CSV report is ready in your downloads.",
    });
  };

  return (
    <AppShell breadcrumbs={["Analytics Studio"]}>
      <PageHeader
        eyebrow="Platform performance"
        title="Analytics Studio"
        description="Customer growth, communication volume, engagement, and revenue signals across the Superblock platform."
        actions={
          <span className="data-freshness">
            <span
              className={cn(
                "size-2 rounded-full",
                isLoading ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
              )}
            />
            {isLoading ? "Syncing..." : "Live sync active"}
          </span>
        }
      />
      <div className="mt-4">
        <AnalyticsToolbar
          dateRange={dateRange}
          setDateRange={setDateRange}
          onExport={exportReport}
          onRefresh={handleRefresh}
          loading={isLoading}
        />
      </div>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {computedKpis.map((kpi, index) => (
          <KpiCard
            key={kpi.label}
            {...kpi}
            icon={metricIcons[index]}
            loading={isLoading}
          />
        ))}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <div className="panel p-4">
          <SectionHeader
            title="User activity"
            description="Daily, weekly, and monthly active users"
            action={
              <div className="flex items-center gap-1">
                {["DAU", "WAU", "MAU"].map((metric) => (
                  <button
                    key={metric}
                    onClick={() => toggleMetric(metric)}
                    className={cn(
                      "chart-toggle",
                      activityMetrics.includes(metric) && "active"
                    )}
                  >
                    {metric}
                  </button>
                ))}
                <ChartMenu state={chartState} setState={setChartState} />
              </div>
            }
          />
          <div className="chart-height">
            {chartState === "empty" ? (
              <EmptyState onReset={() => setChartState("data")} />
            ) : chartState === "error" ? (
              <ErrorState onRetry={() => setChartState("data")} />
            ) : userActivityData.length === 0 ? (
              <EmptyState
                title="No user activity logged"
                description="No daily, weekly, or monthly telemetry events recorded for this period."
                onReset={() => setDateRange("Last 30 days")}
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={userActivityData}
                  margin={{ top: 10, right: 5, left: -12, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="dau" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.24} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="wau" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.14} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--chart-grid)"
                  />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    dy={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickFormatter={(value) => `${value / 1000}k`}
                  />
                  <RechartsTooltip content={<ChartTooltip />} />
                  {activityMetrics.includes("DAU") && (
                    <Area
                      type="monotone"
                      dataKey="dau"
                      name="DAU"
                      stroke="var(--chart-1)"
                      fill="url(#dau)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )}
                  {activityMetrics.includes("WAU") && (
                    <Area
                      type="monotone"
                      dataKey="wau"
                      name="WAU"
                      stroke="var(--chart-2)"
                      fill="url(#wau)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )}
                  {activityMetrics.includes("MAU") && (
                    <Line
                      type="monotone"
                      dataKey="mau"
                      name="MAU"
                      stroke="var(--chart-3)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-2 grid grid-cols-3 divide-x rounded-lg bg-muted/35 px-2 py-2.5 text-center">
            <div>
              <div className="font-tabular text-sm font-semibold">
                {formatNumber(activityStats.dau)}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                DAU
              </div>
            </div>
            <div>
              <div className="font-tabular text-sm font-semibold">
                {formatNumber(activityStats.wau)}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                WAU
              </div>
            </div>
            <div>
              <div className="font-tabular text-sm font-semibold">
                {formatNumber(activityStats.mau)}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                MAU
              </div>
            </div>
          </div>
        </div>

        <div className="panel p-4">
          <SectionHeader
            title="Communication volume"
            description="Outbound messages by channel"
            action={
              <Button variant="ghost" size="icon" className="size-7">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <div className="chart-height">
            {communicationVolumeData.length === 0 ? (
              <EmptyState
                title="No communication volume logged"
                description="Outbound message telemetry has not been recorded for this period."
                onReset={() => setDateRange("Last 30 days")}
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={communicationVolumeData}
                  margin={{ top: 10, right: 4, left: -24, bottom: 0 }}
                  barGap={1}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--chart-grid)"
                  />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                    dy={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  />
                  <RechartsTooltip content={<ChartTooltip suffix="k" />} />
                  <Legend
                    iconType="circle"
                    iconSize={6}
                    wrapperStyle={{ fontSize: "10px", paddingTop: "10px" }}
                  />
                  <Bar
                    dataKey="whatsapp"
                    name="WhatsApp"
                    stackId="a"
                    fill={channelColors.WhatsApp}
                    radius={[0, 0, 2, 2]}
                  />
                  <Bar dataKey="email" name="Email" stackId="a" fill={channelColors.Email} />
                  <Bar dataKey="sms" name="SMS" stackId="a" fill={channelColors.SMS} />
                  <Bar
                    dataKey="broadcasts"
                    name="Broadcasts"
                    stackId="a"
                    fill={channelColors.Broadcasts}
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
            <div>
              <div className="text-[11px] text-muted-foreground">
                Top communication channel
              </div>
              <div className="mt-0.5 text-xs font-semibold">
                {channelBreakdown.topChannelVolume > 0
                  ? `${channelBreakdown.topChannelName} · ${channelBreakdown.topChannelShare}% of volume`
                  : "No channel volume recorded"}
              </div>
            </div>
            <span className="font-tabular text-sm font-semibold">
              {formatNumber(channelBreakdown.topChannelVolume)}
            </span>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="panel p-4 lg:col-span-1">
          <SectionHeader
            title="Conversations"
            description={`${formatNumber(conversationStats.total)} conversations this period`}
          />
          <div className="relative mx-auto h-[205px] max-w-[300px]">
            {conversationStats.total === 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[{ name: "No conversations", value: 1 }]}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={84}
                    paddingAngle={0}
                    stroke="none"
                  >
                    <Cell fill="var(--muted)" fillOpacity={0.35} />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={conversationStats.series.filter((item) => item.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={84}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {conversationStats.series.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="font-tabular text-xl font-semibold tracking-[-0.04em]">
                  {formatNumber(conversationStats.total)}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Total
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {conversationStats.series.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between rounded-md bg-muted/35 px-2.5 py-2 text-[11px]"
              >
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: item.color }}
                  />
                  {item.name}
                </span>
                <span className="font-tabular font-semibold">
                  {formatNumber(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel p-4 lg:col-span-2">
          <SectionHeader
            title="Customer growth"
            description="Activation, churn, and renewal cohorts"
            action={<StatusBadge status={growthStatus} />}
          />
          <div className="h-[270px]">
            {customerGrowthData.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <EmptyState
                  title="No customer growth history"
                  description="Insufficient registration cohorts recorded for trend visualization."
                  onReset={() => setDateRange("Last 30 days")}
                />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={customerGrowthData}
                  margin={{ top: 10, right: 6, left: -18, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--chart-grid)"
                  />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    dy={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Area
                    dataKey="new"
                    name="New"
                    type="monotone"
                    stroke="var(--chart-1)"
                    fill="var(--chart-1)"
                    fillOpacity={0.08}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    dataKey="activated"
                    name="Activated"
                    type="monotone"
                    stroke="var(--positive)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    dataKey="churned"
                    name="Churned"
                    type="monotone"
                    stroke="var(--negative)"
                    strokeWidth={1.6}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Line
                    dataKey="renewed"
                    name="Renewed"
                    type="monotone"
                    stroke="var(--chart-4)"
                    strokeWidth={1.6}
                    dot={false}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={6}
                    wrapperStyle={{ fontSize: "10px" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 2xl:grid-cols-[1.35fr_1fr]">
        <div className="panel overflow-hidden">
          <div className="p-4 pb-2">
            <SectionHeader
              title="Top customers by usage"
              description="Ranked by total cross-channel volume"
              action={
                <Link
                  href="/customers"
                  className="inline-flex items-center text-[12px] font-medium text-muted-foreground hover:text-foreground"
                >
                  View all <ChevronRight className="size-3" />
                </Link>
              }
            />
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[760px]">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="text-right">Messages</th>
                  <th className="text-right">Broadcasts</th>
                  <th className="text-right">Conversations</th>
                  <th className="text-right">Total usage</th>
                  <th className="text-right">MRR</th>
                </tr>
              </thead>
              <tbody>
                {enrichedTopCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                      No customer usage records available
                    </td>
                  </tr>
                ) : (
                  enrichedTopCustomers.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <Link
                          href={`/customers/${customer.id}`}
                          className="font-medium hover:underline"
                        >
                          {customer.company}
                        </Link>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {customer.id}
                        </div>
                      </td>
                      <td className="text-right font-tabular">
                        {formatNumber(customer.realUsage.messages)}
                      </td>
                      <td className="text-right font-tabular">
                        {formatNumber(customer.realUsage.broadcasts)}
                      </td>
                      <td className="text-right font-tabular">
                        {formatNumber(customer.realUsage.conversations)}
                      </td>
                      <td className="text-right font-tabular">
                        {formatNumber(customer.realUsage.totalUsage)}
                      </td>
                      <td className="text-right font-tabular font-medium">
                        {formatCurrency(customer.realMrr)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel overflow-hidden">
          <div className="p-4 pb-2">
            <SectionHeader
              title="Recent activity"
              description="Live workspace events"
              action={
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                  <span className="size-2 rounded-full bg-emerald-500" /> LIVE
                </span>
              }
            />
          </div>
          {filteredActivities.length === 0 ? (
            <div className="p-8 text-center">
              <EmptyState
                title="No recent activity"
                description="No platform or customer operational events recorded for this period."
                onReset={() => setDateRange("Last 30 days")}
              />
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredActivities.slice(0, 6).map((item) => {
                const timeStr =
                  item.time ||
                  (item.created_at
                    ? new Date(item.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—");
                const actTitle = item.title || item.action_text || item.type || "Activity";
                const customerName = item.customerName || item.clientUserId || "SuperBlock Customer";
                const channelText = item.channel || item.actor || "System";
                const detailText =
                  item.detail && item.detail !== "—"
                    ? item.detail
                    : item.description || item.message || "Completed";
                const status = item.status || "Completed";

                return (
                  <div
                    key={item.id || `${timeStr}-${customerName}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="w-12 font-mono text-[10px] text-muted-foreground">
                      {timeStr}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">
                        {actTitle}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {customerName} · {channelText} · {detailText}
                      </div>
                    </div>
                    <StatusBadge status={status} dot={false} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function ChartMenu({
  state,
  setState,
}: {
  state: ChartState;
  setState: (state: ChartState) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setState("data")}>Show data</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setState("empty")}>
          Preview empty state
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setState("error")}>
          Preview error state
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  suffix = "",
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover p-2.5 text-popover-foreground shadow-lg">
      <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">
        {label}
      </div>
      {payload.map((item) => (
        <div
          key={item.name}
          className="flex min-w-[120px] items-center justify-between gap-4 py-0.5 text-[11px]"
        >
          <span className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.name}
          </span>
          <span className="font-tabular font-semibold">
            {(Number(item.value) || 0).toLocaleString("en-IN")}
            {suffix}
          </span>
        </div>
      ))}
    </div>
  );
}
