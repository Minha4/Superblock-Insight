import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  Download,
  Filter,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Save,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  Avatar,
  PageHeader,
  StatusBadge,
  TableSearch,
  downloadCsv,
} from "@/components/dashboard-ui";
import { QuickFormDialog } from "@/components/ActionDialogs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { type Customer } from "@/types/customer";
import { useCustomerAnalytics } from "@/lib/api/customerAnalytics";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const columns = [
  "Customer",
  "Contact",
  "Activated",
  "Subscription",
  "Plan",
  "Renewal",
  "MRR",
  "Usage",
  "Last activity",
  "Health",
] as const;
type Column = (typeof columns)[number];
type SortKey = "company" | "activatedAt" | "renewal" | "mrr" | "usage" | "health";

export default function Customers() {
  const { customers, loading, error, refresh } = useCustomerAnalytics();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [plan, setPlan] = useState("All plans");
  const [health, setHealth] = useState("All health");
  const [sortKey, setSortKey] = useState<SortKey>("company");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [visible, setVisible] = useState<Column[]>([...columns]);
  const [selected, setSelected] = useState<string[]>([]);

  // Display all valid customers (real Superblock customers and provisioned records)
  const displayCustomers = customers;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const compactQ = q.replace(/[^a-z0-9]/g, "");

    const rows = displayCustomers.filter((customer) => {
      const companyLower = (customer.company || "").toLowerCase();
      const companyCompact = companyLower.replace(/[^a-z0-9]/g, "");
      const idLower = (customer.id || "").toLowerCase();
      const idCompact = idLower.replace(/[^a-z0-9]/g, "");
      const contactName = (customer.contact?.name || "").toLowerCase();
      const contactEmail = (customer.contact?.email || "").toLowerCase();
      const emailUserPart = contactEmail.split("@")[0] || "";
      const matchesEmail = q.includes("@")
        ? contactEmail.includes(q)
        : emailUserPart.includes(q);
      const contactPhone = (customer.contact?.phone || "").toLowerCase();
      const industry = (customer.industry || "").toLowerCase();
      const region = (customer.region || "").toLowerCase();
      const planName = (customer.plan || "").toLowerCase();

      const matchesQuery =
        !q ||
        companyLower.includes(q) ||
        companyCompact.includes(compactQ) ||
        idLower.includes(q) ||
        idCompact.includes(compactQ) ||
        contactName.includes(q) ||
        matchesEmail ||
        contactPhone.includes(q) ||
        industry.includes(q) ||
        region.includes(q) ||
        planName.includes(q);

      return (
        matchesQuery &&
        (status === "All statuses" || (customer.status as string) === status) &&
        (plan === "All plans" || customer.plan === plan) &&
        (health === "All health" || (customer.health?.status as string) === health)
      );
    });

    return rows.sort((a, b) => {
      if (q) {
        const aComp = (a.company || "").toLowerCase();
        const bComp = (b.company || "").toLowerCase();
        const aExact = aComp === q;
        const bExact = bComp === q;
        if (aExact !== bExact) return aExact ? -1 : 1;

        const aStarts = aComp.startsWith(q);
        const bStarts = bComp.startsWith(q);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
      }
      const values: Record<SortKey, [string | number, string | number]> = {
        company: [a.company, b.company],
        activatedAt: [a.activatedAt, b.activatedAt],
        renewal: [a.renewal, b.renewal],
        mrr: [a.subscription?.mrr ?? 0, b.subscription?.mrr ?? 0],
        usage: [
          (a.usage?.contacts || a.usage?.messages) ?? 0,
          (b.usage?.contacts || b.usage?.messages) ?? 0,
        ],
        health: [a.health?.score ?? 0, b.health?.score ?? 0],
      };
      const [left, right] = values[sortKey];
      const result =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right));
      return sortDirection === "asc" ? result : -result;
    });
  }, [displayCustomers, query, status, plan, health, sortKey, sortDirection]);

  const isVisible = (column: Column) => visible.includes(column);
  const clearFilters = () => {
    setQuery("");
    setStatus("All statuses");
    setPlan("All plans");
    setHealth("All health");
  };
  const sort = (key: SortKey) => {
    if (sortKey === key) setSortDirection((value) => (value === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };
  const exportRows = () => {
    downloadCsv(
      "superblock-customers.csv",
      filtered.map((c) => ({
        ID: c.id,
        Customer: c.company,
        "Contact Name": c.contact.name,
        "Contact Email": c.contact.email,
        "Business Phone ID": c.contact.phone,
        Activated: c.activatedAt,
        Status: "—",
        Plan: "—",
        MRR: "—",
        Usage: "—",
        Health: "—",
      }))
    );
    toast.success("Customer list exported");
  };
  const allSelected =
    filtered.length > 0 && filtered.every((customer) => selected.includes(customer.id));

  return (
    <AppShell breadcrumbs={["Customers"]}>
      <PageHeader
        eyebrow="Customer operations"
        title="Customers"
        description="Manage subscriptions, account health, ownership, renewal risk, and platform adoption from one workspace."
        actions={
          <QuickFormDialog
            type="customer"
            title="Add customer"
            description="Provision a new customer record in the workspace."
            trigger={
              <Button size="sm">
                <Plus className="size-3.5" />
                Add customer
              </Button>
            }
          />
        }
      />

      <div className="mt-4 panel overflow-hidden">
        <TableSearch
          value={query}
          onChange={(value) => {
            setQuery(value);
          }}
          placeholder="Search company, ID, contact, or email…"
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 bg-card text-xs cursor-pointer"
                onClick={() => {
                  refresh();
                  toast.success("Refreshing customer data");
                }}
                disabled={loading}
              >
                <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 bg-card text-xs"
                onClick={() =>
                  toast.success("Filter saved", {
                    description: "Customer operations · Personal view",
                  })
                }
              >
                <Save className="size-3.5" />
                Save view
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 bg-card text-xs">
                    <Columns3 className="size-3.5" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {columns.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column}
                      checked={visible.includes(column)}
                      onCheckedChange={(checked) =>
                        setVisible((items) =>
                          checked ? [...items, column] : items.filter((item) => item !== column)
                        )
                      }
                    >
                      {column}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                className="h-8 bg-card text-xs"
                onClick={exportRows}
              >
                <Download className="size-3.5" />
                Export
              </Button>
            </>
          }
        />

        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-muted/15 px-3 py-2">
          <Filter className="size-3.5 text-muted-foreground" />
          <FilterSelect
            value={status}
            onChange={(value) => {
              setStatus(value);
            }}
            items={["All statuses", "Active", "Paid", "Trial", "Renewal Due", "Suspended", "Expired"]}
          />
          <FilterSelect
            value={plan}
            onChange={(value) => {
              setPlan(value);
            }}
            items={["All plans", "Starter", "Growth", "Advanced", "Custom"]}
          />
          <FilterSelect
            value={health}
            onChange={(value) => {
              setHealth(value);
            }}
            items={["All health", "Healthy", "At Risk", "Expansion", "Renewal Risk"]}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] text-muted-foreground cursor-pointer"
            onClick={clearFilters}
          >
            Clear filters
          </Button>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            {loading ? "Loading…" : `${filtered.length} records`}
          </span>
        </div>

        {selected.length > 0 && (
          <div className="flex items-center gap-3 border-b border-primary/20 bg-primary/5 px-3 py-2">
            <span className="text-[12px] font-medium">{selected.length} selected</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 bg-card text-[11px]"
              onClick={() => toast.success("Owner updated for selected customers")}
            >
              Assign owner
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 bg-card text-[11px]"
              onClick={() => toast.success("Tags applied")}
            >
              Add tag
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 text-[11px]"
              onClick={() => setSelected([])}
            >
              Clear
            </Button>
          </div>
        )}

        <div className="overflow-x-auto max-h-[calc(100vh-270px)] min-h-[420px] overflow-y-auto subtle-scrollbar">
          <table className="data-table min-w-[1240px]">
            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-xs">
              <tr>
                <th className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) =>
                      setSelected(
                        checked
                          ? Array.from(new Set([...selected, ...filtered.map((c) => c.id)]))
                          : []
                      )
                    }
                    aria-label="Select all customers"
                  />
                </th>
                {isVisible("Customer") && (
                  <SortableHead
                    label="Customer"
                    field="company"
                    current={sortKey}
                    direction={sortDirection}
                    onSort={sort}
                  />
                )}
                {isVisible("Contact") && <th>Contact / email</th>}
                {isVisible("Activated") && (
                  <SortableHead
                    label="Activated"
                    field="activatedAt"
                    current={sortKey}
                    direction={sortDirection}
                    onSort={sort}
                  />
                )}
                {isVisible("Subscription") && <th>Subscription</th>}
                {isVisible("Plan") && <th>Plan</th>}
                {isVisible("Renewal") && (
                  <SortableHead
                    label="Renewal"
                    field="renewal"
                    current={sortKey}
                    direction={sortDirection}
                    onSort={sort}
                  />
                )}
                {isVisible("MRR") && (
                  <SortableHead
                    label="MRR"
                    field="mrr"
                    current={sortKey}
                    direction={sortDirection}
                    onSort={sort}
                    align="right"
                  />
                )}
                {isVisible("Usage") && (
                  <SortableHead
                    label="Total usage"
                    field="usage"
                    current={sortKey}
                    direction={sortDirection}
                    onSort={sort}
                    align="right"
                  />
                )}
                {isVisible("Last activity") && <th>Last activity</th>}
                {isVisible("Health") && (
                  <SortableHead
                    label="Health"
                    field="health"
                    current={sortKey}
                    direction={sortDirection}
                    onSort={sort}
                  />
                )}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={visible.length + 2} className="py-14 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="size-5 animate-spin text-primary" />
                      <span className="text-xs">Loading customer analytics…</span>
                    </div>
                  </td>
                </tr>
              ) : error && filtered.length === 0 ? (
                <tr>
                  <td colSpan={visible.length + 2} className="py-12 text-center text-destructive">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="size-5" />
                      <span className="text-xs font-medium">{error}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refresh()}
                        className="mt-2 text-xs"
                      >
                        Retry
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={visible.length + 2} className="py-12 text-center text-xs text-muted-foreground">
                    No customer records found.
                  </td>
                </tr>
              ) : (
                filtered.map((customer) => (
                  <CustomerRow
                    key={customer.id}
                    customer={customer}
                    isVisible={isVisible}
                    selected={selected.includes(customer.id)}
                    toggleSelected={() =>
                      setSelected((items) =>
                        items.includes(customer.id)
                          ? items.filter((id) => id !== customer.id)
                          : [...items, customer.id]
                      )
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-border/70 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[11px] text-muted-foreground">
            {filtered.length === 0
              ? "0 customers"
              : `Showing all ${filtered.length} customers (scroll to browse)`}
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {filtered.length} of {displayCustomers.length} total
          </span>
        </div>
      </div>
    </AppShell>
  );
}

function FilterSelect({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (value: string) => void;
  items: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-auto min-w-[112px] border-dashed bg-card px-2 text-[11px]">
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

function SortableHead({
  label,
  field,
  current,
  direction,
  onSort,
  align,
}: {
  label: string;
  field: SortKey;
  current: SortKey;
  direction: "asc" | "desc";
  onSort: (key: SortKey) => void;
  align?: "right";
}) {
  return (
    <th className={align === "right" ? "text-right" : ""}>
      <button
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground cursor-pointer",
          align === "right" && "ml-auto"
        )}
        onClick={() => onSort(field)}
      >
        {label}
        {current !== field ? (
          <ArrowUpDown className="size-3 opacity-50" />
        ) : direction === "asc" ? (
          <ArrowUp className="size-3" />
        ) : (
          <ArrowDown className="size-3" />
        )}
      </button>
    </th>
  );
}

function CustomerRow({
  customer,
  isVisible,
  selected,
  toggleSelected,
}: {
  customer: Customer;
  isVisible: (column: Column) => boolean;
  selected: boolean;
  toggleSelected: () => void;
}) {
  return (
    <tr className={cn(selected && "bg-primary/[0.04]")}>
      <td>
        <Checkbox
          checked={selected}
          onCheckedChange={toggleSelected}
          aria-label={`Select ${customer.company}`}
        />
      </td>
      {isVisible("Customer") && (
        <td>
          <Link href={`/customers/${customer.id}`} className="flex items-center gap-2.5 group">
            <Avatar initials={customer.initials} />
            <div>
              <div className="font-medium group-hover:underline">{customer.company}</div>
              <div className="text-[10px] text-muted-foreground">
                {customer.industry !== "—" || customer.region !== "—"
                  ? `${customer.industry} · ${customer.region}`
                  : "—"}
              </div>
            </div>
          </Link>
        </td>
      )}
      {isVisible("Contact") && (
        <td>
          <div>{customer.contact.name || "—"}</div>
          <div className="text-[10px] text-muted-foreground truncate max-w-[220px]">
            {customer.contact.email !== "—"
              ? customer.contact.email
              : customer.contact.phone !== "—"
              ? `Phone ID: ${customer.contact.phone}`
              : "—"}
          </div>
        </td>
      )}
      {isVisible("Activated") && (
        <td>
          <span className="text-muted-foreground">{customer.activatedAt || "—"}</span>
        </td>
      )}
      {isVisible("Subscription") && (
        <td>
          {customer.status ? (
            <StatusBadge status={customer.status} />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      )}
      {isVisible("Plan") && (
        <td>
          {customer.plan && customer.plan !== "—" ? (
            <span className="rounded-md border bg-muted/30 px-2 py-1 text-[11px] font-medium">
              {customer.plan}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      )}
      {isVisible("Renewal") && (
        <td>
          <span className="text-muted-foreground">{customer.renewal || "—"}</span>
        </td>
      )}
      {isVisible("MRR") && (
        <td className="text-right font-tabular font-medium">
          {customer.subscription.mrr > 0 ? (
            formatCurrency(customer.subscription.mrr)
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      )}
      {isVisible("Usage") && (
        <td className="text-right font-tabular">
          {customer.usage.contacts && customer.usage.contacts > 0 ? (
            <span title={`${customer.usage.contacts} CRM contacts`}>
              {formatNumber(customer.usage.contacts)} contacts
            </span>
          ) : customer.usage.messages > 0 ? (
            formatNumber(customer.usage.messages)
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      )}
      {isVisible("Last activity") && (
        <td>
          <span className="text-muted-foreground">{customer.lastActivity || "—"}</span>
        </td>
      )}
      {isVisible("Health") && (
        <td>
          {customer.health.score > 0 ? (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full border font-tabular text-[11px] font-semibold",
                  customer.health.score >= 75
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                    : customer.health.score >= 60
                    ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
                    : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
                )}
              >
                {customer.health.score}
              </span>
              <span className="text-[11px]">{customer.health.status}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      )}
      <td>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/customers/${customer.id}`}>View customer</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.success("Customer edit opened")}>
              Edit customer
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.success("Note added to customer")}>
              Add note
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-rose-600"
              onClick={() => toast.success("Customer access suspended")}
            >
              Suspend access
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}
