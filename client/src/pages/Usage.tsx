import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Box, Download, MessageCircle, Workflow, Zap } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AnalyticsToolbar, PageHeader, SectionHeader, StatusBadge, downloadCsv } from "@/components/dashboard-ui";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNumber } from "@/data/mockData";
import { useCustomerAnalytics } from "@/lib/api/customerAnalytics";
import { useUsageMetrics } from "@/lib/api/usage";
import { toast } from "sonner";

export default function Usage() {
  const { customers, loading: customersLoading, refresh: reloadAnalytics } = useCustomerAnalytics();
  const { data: usageData, loading: usageLoading, refresh: reloadUsage } = useUsageMetrics();

  const [range, setRange] = useState("Last 30 days");
  const [channel, setChannel] = useState("All channels");
  const [product, setProduct] = useState("All products");
  const [region, setRegion] = useState("All regions");

  const loading = customersLoading || usageLoading;

  const rows = useMemo(() => {
    return customers
      .filter((customer) => region === "All regions" || customer.region.includes(region))
      .sort((a, b) => (b.usage?.messages || 0) - (a.usage?.messages || 0));
  }, [customers, region]);

  const totals = useMemo(() => {
    // 1. Messages: Prefer real public.usage_metrics aggregated breakdown, or customer accounts sum, or plan message volume
    const liveMessagesMetric = usageData?.metricBreakdown?.messages?.totalValue;
    const planMessagesQuota = usageData?.planMetrics?.totalConfiguredMessageVolume;
    const customerMessagesSum = customers.reduce((acc, c) => acc + (c.usage?.messages || 0), 0);
    const rawMessages = liveMessagesMetric ?? (customerMessagesSum > 0 ? customerMessagesSum : (planMessagesQuota ?? 0));

    // 2. API Requests
    const liveApiMetric =
      usageData?.metricBreakdown?.api_requests?.totalValue ??
      usageData?.metricBreakdown?.api?.totalValue;
    const customerApiSum = customers.reduce((acc, c) => acc + (c.usage?.api || 0), 0);
    const rawApi = liveApiMetric ?? customerApiSum;

    // 3. Automations
    const liveAutomationsMetric = usageData?.metricBreakdown?.automations?.totalValue;
    const customerAutomationsSum = customers.reduce((acc, c) => acc + (c.usage?.automations || 0), 0);
    const rawAutomations = liveAutomationsMetric ?? customerAutomationsSum;

    // 4. Storage
    const liveStorageMetric = usageData?.metricBreakdown?.storage?.totalValue;
    const customerStorageSum = customers.reduce((acc, c) => acc + (c.usage?.storage || 0), 0);
    const rawStorage = liveStorageMetric ?? customerStorageSum;

    // 5. Active conversations / Contacts
    const liveConversationsMetric = usageData?.metricBreakdown?.conversations?.totalValue;
    const liveContactsMetric = usageData?.contactsSummary?.totalContacts;
    const customerConversationsSum = customers.reduce((acc, c) => acc + (c.usage?.conversations || 0), 0);
    const rawConversations = liveConversationsMetric ?? (liveContactsMetric ?? customerConversationsSum);

    return {
      messages: rawMessages > 0 ? formatNumber(rawMessages) : "0",
      rawMessages,
      messagesSubtext: liveMessagesMetric !== undefined
        ? "Verified delivery"
        : planMessagesQuota
        ? "Configured plan quota"
        : "Live metric",
      api: rawApi > 0 ? formatNumber(rawApi) : "0",
      rawApi,
      apiSubtext: rawApi > 0 ? "Live requests" : "No requests recorded",
      automations: rawAutomations > 0 ? formatNumber(rawAutomations) : "0",
      rawAutomations,
      automationsSubtext: rawAutomations > 0 ? "Live runs" : "No automations recorded",
      storage: rawStorage > 0 ? `${rawStorage} GB` : "0 GB",
      rawStorage,
      storageSubtext: rawStorage > 0 ? "Allocated" : "No storage recorded",
      conversations: rawConversations > 0 ? formatNumber(rawConversations) : "0",
      rawConversations,
      conversationsSubtext: liveContactsMetric !== undefined
        ? "Operational contacts"
        : rawConversations > 0
        ? "Active sessions"
        : "No active sessions",
    };
  }, [customers, usageData]);

  const totalEvents = totals.rawMessages + totals.rawApi + totals.rawConversations;

  // Real channel mix calculation or honest zero state
  const channelMix = useMemo(() => {
    const rawWhatsApp = totals.rawMessages;
    const rawApi = totals.rawApi;
    const sum = rawWhatsApp + rawApi;

    if (sum === 0) {
      return [
        { name: "WhatsApp", value: 0, fill: "var(--whatsapp)" },
        { name: "Email", value: 0, fill: "var(--email)" },
        { name: "SMS", value: 0, fill: "var(--sms)" },
        { name: "API & other", value: 0, fill: "var(--chart-4)" },
      ];
    }

    const whatsappPct = Math.round((rawWhatsApp / sum) * 100);
    const apiPct = 100 - whatsappPct;

    return [
      { name: "WhatsApp", value: whatsappPct, fill: "var(--whatsapp)" },
      { name: "Email", value: 0, fill: "var(--email)" },
      { name: "SMS", value: 0, fill: "var(--sms)" },
      { name: "API & other", value: apiPct, fill: "var(--chart-4)" },
    ];
  }, [totals]);

  // Real historical trend data if available in usage_metrics
  const trendData = useMemo(() => {
    if (!usageData?.usageMetrics || usageData.usageMetrics.length === 0) {
      return [];
    }

    // Group genuine usage_metrics by date
    const dateMap = new Map<string, { date: string; messages: number; api: number }>();
    for (const record of usageData.usageMetrics) {
      if (!record.recorded_at) continue;
      const dateKey = record.recorded_at.slice(0, 10);
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { date: dateKey, messages: 0, api: 0 });
      }
      const entry = dateMap.get(dateKey)!;
      const val = Number(record.metric_value) || 0;
      if (record.metric_name === "messages") {
        entry.messages += val;
      } else {
        entry.api += val;
      }
    }

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [usageData]);

  const handleRefresh = async () => {
    try {
      await Promise.allSettled([reloadAnalytics(), reloadUsage()]);
      toast.success("Usage metrics refreshed from live source");
    } catch {
      toast.error("Failed to refresh usage data");
    }
  };

  const exportUsage = () => {
    downloadCsv(
      "superblock-usage.csv",
      rows.map((c) => ({
        Customer: c.company,
        Region: c.region,
        Messages: c.usage?.messages || 0,
        API: c.usage?.api || 0,
        Automations: c.usage?.automations || 0,
      }))
    );
    toast.success("Usage exported");
  };

  return (
    <AppShell breadcrumbs={["Usage"]}>
      <PageHeader
        eyebrow="Platform utilization"
        title="Usage"
        description="Analyze communication volume, API consumption, automation executions, and storage across customers and products."
      />
      <div className="mt-4">
        <AnalyticsToolbar
          dateRange={range}
          setDateRange={setRange}
          onExport={exportUsage}
          onRefresh={handleRefresh}
          loading={loading}
        />
      </div>

      {usageData?.warning && (
        <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <span className="font-semibold">Operational Data Notice:</span> {usageData.warning}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <SmallSelect
          value={channel}
          onChange={setChannel}
          items={["All channels", "WhatsApp", "Email", "SMS", "Broadcast"]}
        />
        <SmallSelect
          value={product}
          onChange={setProduct}
          items={["All products", "Team Inbox", "Broadcast Studio", "AI Agent", "CRM"]}
        />
        <SmallSelect
          value={region}
          onChange={setRegion}
          items={["All regions", "India", "ap-south-1", "UAE", "Singapore"]}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Messages", totals.messages, totals.messagesSubtext, MessageCircle],
          ["API requests", totals.api, totals.apiSubtext, Zap],
          ["Automations", totals.automations, totals.automationsSubtext, Workflow],
          ["Storage", totals.storage, totals.storageSubtext, Box],
          ["Active conversations", totals.conversations, totals.conversationsSubtext, Activity],
        ].map(([label, value, subtext, Icon]) => (
          <div className="metric-card" key={label as string}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {label as string}
              </span>
              <Icon className="size-3.5 text-muted-foreground" />
            </div>
            <div className="mt-4 font-tabular text-2xl font-semibold">
              {value as string}
            </div>
            <div className="mt-1 text-[11px] font-medium text-muted-foreground">
              {subtext as string}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="panel p-4">
          <SectionHeader
            title="Usage trend"
            description={`${range} · ${channel} · ${product}`}
          />
          <div className="h-[310px]">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trendData}
                  margin={{ top: 8, right: 5, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="usage-main" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="var(--chart-1)" stopOpacity={0.25} />
                      <stop offset="1" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
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
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      fontSize: 10,
                      background: "var(--popover)",
                      borderColor: "var(--border)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="messages"
                    name="Messages"
                    stroke="var(--whatsapp)"
                    fill="url(#usage-main)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="api"
                    name="API Requests"
                    stroke="var(--chart-4)"
                    fill="transparent"
                    strokeWidth={1.8}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center p-6">
                <Activity className="size-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium text-foreground">No historical trend data available</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Historical telemetry will automatically plot here as metrics are logged to the SuperBlock operational database.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="panel p-4">
          <SectionHeader
            title="Channel mix"
            description="Share of total platform events"
          />
          <div className="relative h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={channelMix}
                  dataKey="value"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={2}
                  stroke="none"
                >
                  {channelMix.map((item) => (
                    <Cell key={item.name} fill={item.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    fontSize: 10,
                    background: "var(--popover)",
                    borderColor: "var(--border)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="font-tabular text-xl font-semibold">
                  {totalEvents > 0 ? formatNumber(totalEvents) : "0"}
                </div>
                <div className="text-[10px] text-muted-foreground">events</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {channelMix.map((item) => (
              <div
                className="flex items-center justify-between rounded-md bg-muted/35 p-2 text-[11px]"
                key={item.name}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: item.fill }}
                  />
                  {item.name}
                </span>
                <b>{item.value}%</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 panel overflow-hidden">
        <div className="flex items-center justify-between p-4 pb-2">
          <SectionHeader
            title="Usage by customer"
            description="Cross-channel and product consumption"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 bg-card text-xs"
            onClick={exportUsage}
          >
            <Download className="size-3.5" />
            Export
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[930px]">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Region</th>
                <th className="text-right">Messages</th>
                <th className="text-right">Conversations</th>
                <th className="text-right">API</th>
                <th className="text-right">Automations</th>
                <th className="text-right">Storage</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    {loading ? "Loading usage records..." : "No customer usage records available"}
                  </td>
                </tr>
              ) : (
                rows.map((customer) => (
                  <tr key={customer.id}>
                    <td className="font-medium">
                      {customer.company}
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {customer.id}
                      </div>
                    </td>
                    <td>{customer.region}</td>
                    <td className="text-right font-tabular">
                      {formatNumber(customer.usage?.messages || 0)}
                    </td>
                    <td className="text-right font-tabular">
                      {formatNumber(customer.usage?.conversations || 0)}
                    </td>
                    <td className="text-right font-tabular">
                      {formatNumber(customer.usage?.api || 0)}
                    </td>
                    <td className="text-right font-tabular">
                      {formatNumber(customer.usage?.automations || 0)}
                    </td>
                    <td className="text-right font-tabular">
                      {customer.usage?.storage || 0} GB
                    </td>
                    <td>
                      <StatusBadge
                        status={
                          customer.health?.usageTrend === "Declining"
                            ? "At Risk"
                            : customer.health?.usageTrend === "Stable"
                            ? "Private"
                            : "Active"
                        }
                        dot={false}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function SmallSelect({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (v: string) => void;
  items: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-auto min-w-[135px] bg-card text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item} value={item}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
