import { type ComponentType, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, ChevronDown, Download, Inbox, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="brand-mark-shell">
        <img src="/manus-storage/superblock-logo_12236878.png" alt="Superblock" className="size-7 rounded-[7px] object-cover" />
      </span>
      {!compact && (
        <div className="min-w-0 leading-none">
          <div className="text-[14px] font-semibold tracking-[-0.025em]">Superblock</div>
          <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Analytics Studio <span className="size-1.5 rounded-full bg-primary" />
          </div>
        </div>
      )}
    </div>
  );
}

const badgeMap: Record<string, string> = {
  Active: "status-success",
  Paid: "status-success",
  Healthy: "status-success",
  Delivered: "status-success",
  Success: "status-success",
  Current: "status-success",
  Trial: "status-info",
  Expansion: "status-info",
  Opened: "status-info",
  Beta: "status-info",
  Private: "status-neutral",
  Away: "status-neutral",
  Draft: "status-neutral",
  Sent: "status-info",
  "Renewal Due": "status-warning",
  "Renewal Risk": "status-warning",
  "Follow-up due": "status-warning",
  Overdue: "status-danger",
  "At Risk": "status-danger",
  Suspended: "status-danger",
  Cancelled: "status-danger",
  Expired: "status-danger",
  "Past due": "status-danger",
  Unconfigured: "status-neutral",
};

export function StatusBadge({ status, dot = true }: { status: string; dot?: boolean }) {
  return <span className={cn("status-badge", badgeMap[status] || "status-neutral")}>{dot && <span className="size-2 rounded-full bg-current opacity-80" />}{status}</span>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/70 pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow && <div className="section-kicker">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-[-0.015em]">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function KpiCard({ label, value, change, comparison, spark, icon: Icon, loading = false }: { label: string; value: string; change: number; comparison: string; spark: number[]; icon: ComponentType<{ className?: string }>; loading?: boolean }) {
  if (loading) return <div className="metric-card space-y-4"><Skeleton className="h-3 w-28" /><Skeleton className="h-8 w-24" /><Skeleton className="h-10 w-full" /></div>;
  const data = spark.map((value, index) => ({ index, value }));
  const positive = change >= 0;
  return (
    <div className="metric-card group">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
        <span className="metric-icon"><Icon className="size-3.5" /></span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="font-tabular text-[25px] font-semibold leading-none tracking-[-0.04em]">{value}</div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn("inline-flex items-center font-semibold", positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
              {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{Math.abs(change)}%
            </span>
            <span>{comparison}</span>
          </div>
        </div>
        <div className="h-10 w-24 opacity-80 transition-opacity group-hover:opacity-100">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 3, right: 1, left: 1, bottom: 1 }}>
              <defs><linearGradient id={`spark-${label.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={positive ? "var(--positive)" : "var(--negative)"} stopOpacity={0.28} /><stop offset="100%" stopColor={positive ? "var(--positive)" : "var(--negative)"} stopOpacity={0} /></linearGradient></defs>
              <Area type="monotone" dataKey="value" stroke={positive ? "var(--positive)" : "var(--negative)"} strokeWidth={1.8} fill={`url(#spark-${label.replace(/\s/g, "")})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsToolbar({ dateRange, setDateRange, onExport, onRefresh, loading, showCustomer = true }: { dateRange: string; setDateRange: (value: string) => void; onExport: () => void; onRefresh: () => void; loading?: boolean; showCustomer?: boolean }) {
  return (
    <div className="toolbar">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="h-8 w-[148px] bg-card text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["Today", "Yesterday", "Last 7 days", "Last 30 days", "This month", "Last month", "Custom range"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
        {showCustomer && <Button variant="outline" size="sm" className="h-8 bg-card text-xs"><SlidersHorizontal className="size-3.5" /> Customers <ChevronDown className="size-3" /></Button>}
        <Button variant="outline" size="sm" className="h-8 bg-card text-xs"><BarChart3 className="size-3.5" /> All channels <ChevronDown className="size-3" /></Button>
        <span className="hidden items-center gap-2 px-2 text-[12px] text-muted-foreground xl:flex"><span className="size-2 rounded-full bg-emerald-500" />Connected to Superblock Platform</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-8 bg-card text-xs" onClick={onRefresh} disabled={loading}><RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Refresh</Button>
        <Button size="sm" className="h-8 text-xs" onClick={onExport}><Download className="size-3.5" /> Export</Button>
      </div>
    </div>
  );
}

export function TableSearch({ value, onChange, placeholder = "Search records...", actions }: { value: string; onChange: (value: string) => void; placeholder?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-[320px]">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-8 bg-background pl-8 text-xs" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title = "No data to display", description = "Adjust the filters or choose another date range.", onReset }: { title?: string; description?: string; onReset?: () => void }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center px-6 text-center">
      <span className="mb-3 grid size-10 place-items-center rounded-xl border bg-muted/40 text-muted-foreground"><Inbox className="size-4" /></span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">{description}</p>
      {onReset && <Button variant="outline" size="sm" className="mt-4 h-8 bg-card text-xs" onClick={onReset}>Reset filters</Button>}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center px-6 text-center">
      <span className="mb-3 grid size-10 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-950 dark:bg-rose-950/30"><RefreshCw className="size-4" /></span>
      <h3 className="text-sm font-semibold">Analytics temporarily unavailable</h3>
      <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">Analytics service is temporarily unreachable. Please retry.</p>
      <Button variant="outline" size="sm" className="mt-4 h-8 bg-card text-xs" onClick={onRetry}>Try again</Button>
    </div>
  );
}

export function Avatar({ initials, size = "md", className }: { initials: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return <span className={cn("avatar", size === "sm" && "size-6 text-[10px]", size === "md" && "size-8 text-[11px]", size === "lg" && "size-12 text-[14px]", className)}>{initials}</span>;
}

export function downloadCsv(filename: string, rows: Record<string, string | number | boolean | undefined>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
