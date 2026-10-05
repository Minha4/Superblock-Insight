import { useState, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  BarChart3,
  Bell,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  FileText,
  HelpCircle,
  LogOut,
  Menu,
  Moon,
  PackageOpen,
  Search,
  Settings,
  Sun,
  UserCheck,
  Users,
  UsersRound,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, BrandMark } from "@/components/dashboard-ui";
import { GlobalSearch } from "@/components/GlobalSearch";

const sections = [
  {
    label: "Platform",
    items: [
      { title: "Analytics Studio", href: "/analytics", icon: BarChart3 },
      { title: "Customers", href: "/customers", icon: UsersRound },
      { title: "Users", href: "/users", icon: UserCheck },
      { title: "Usage", href: "/usage", icon: Zap },
    ],
  },
  {
    label: "Billing",
    items: [
      { title: "Subscriptions", href: "/subscriptions", icon: CreditCard },
      { title: "Products & Plans", href: "/products", icon: PackageOpen },
      { title: "Invoices", href: "/invoices", icon: FileText },
    ],
  },
  {
    label: "Workspace",
    items: [
      { title: "Team", href: "/team", icon: Users },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

function NavContent({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const [location] = useLocation();
  const { user } = useAuth();

  return (
    <>
      <div
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border px-3",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        <BrandMark compact={collapsed} />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {sections.map((section) => (
          <div key={section.label} className="mb-4">
            {!collapsed && (
              <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                {section.label}
              </div>
            )}
            <nav className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  location === item.href ||
                  (item.href === "/customers" &&
                    location.startsWith("/customers/")) ||
                  (item.href === "/users" &&
                    location.startsWith("/users/"));
                const content = (
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "sidebar-link",
                      active && "active",
                      collapsed && "justify-center px-0"
                    )}
                  >
                    <item.icon className="size-[15px] shrink-0" />
                    {!collapsed && <span className="truncate">{item.title}</span>}
                    {!collapsed && active && (
                      <span className="ml-auto size-2 rounded-full bg-primary" />
                    )}
                  </Link>
                );
                return collapsed ? (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{content}</TooltipTrigger>
                    <TooltipContent side="right">{item.title}</TooltipContent>
                  </Tooltip>
                ) : (
                  <div key={item.href}>{content}</div>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
      <div className="border-t border-sidebar-border p-2">
        <a
          href="https://superblock.chat/"
          target="_blank"
          rel="noreferrer"
          className={cn(
            "sidebar-link",
            collapsed && "justify-center px-0"
          )}
        >
          <HelpCircle className="size-[15px]" />
          {!collapsed && <span>Help & resources</span>}
        </a>
        {!collapsed && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/45 p-2">
            <Avatar initials={user?.initials || "SH"} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold">
                {user?.businessName || "Superblock HQ"}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Enterprise workspace
              </div>
            </div>
            <ChevronDown className="size-3 text-muted-foreground" />
          </div>
        )}
      </div>
    </>
  );
}

export function AppShell({
  children,
  breadcrumbs,
}: {
  children: ReactNode;
  breadcrumbs?: string[];
}) {
  const {
    sidebarCollapsed,
    toggleSidebar,
    mobileNavOpen,
    setMobileNavOpen,
    setSearchOpen,
    theme,
    setTheme,
  } = useApp();
  const { user, signOut } = useAuth();
  const [, navigate] = useLocation();
  const [notifications, setNotifications] = useState<{
    id: string;
    title: string;
    detail: string;
    type: "warning" | "danger" | "info";
    href: string;
  }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/invoices").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/subscriptions").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([invData, subData]) => {
      const items: {
        id: string;
        title: string;
        detail: string;
        type: "warning" | "danger" | "info";
        href: string;
      }[] = [];
      if (invData?.invoices && Array.isArray(invData.invoices)) {
        const overdue = invData.invoices.filter((inv: any) => inv.status === "Overdue");
        for (const inv of overdue.slice(0, 3)) {
          items.push({
            id: `inv-${inv.id}`,
            title: `Invoice ${inv.invoice_number || inv.id} is overdue`,
            detail: `${inv.customer_name || "Customer"} · ₹${Number(inv.amount || 0).toLocaleString("en-IN")}`,
            type: "danger",
            href: "/invoices",
          });
        }
      }
      if (subData?.subscriptions && Array.isArray(subData.subscriptions)) {
        const expiringSoon = subData.subscriptions.filter((s: any) => {
          if (!s.renewal_date && !s.current_period_end) return false;
          const renDate = new Date(s.renewal_date || s.current_period_end);
          const diffDays = (renDate.getTime() - Date.now()) / (1000 * 3600 * 24);
          return diffDays >= 0 && diffDays <= 30;
        });
        for (const sub of expiringSoon.slice(0, 2)) {
          items.push({
            id: `sub-${sub.id}`,
            title: `${sub.customer_name || "Customer"} renewal due soon`,
            detail: `${sub.plan_name || "Plan"} · Renewal within 30 days`,
            type: "warning",
            href: "/subscriptions",
          });
        }
      }
      setNotifications(items);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex lg:flex-col",
          sidebarCollapsed ? "w-[64px]" : "w-[220px]"
        )}
      >
        <NavContent collapsed={sidebarCollapsed} />
        <Button
          variant="outline"
          size="icon"
          className="absolute -right-3 top-20 size-6 rounded-full bg-background shadow-sm"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? (
            <ChevronsRight className="size-3" />
          ) : (
            <ChevronsLeft className="size-3" />
          )}
        </Button>
      </aside>

      {mobileNavOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col border-r bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:hidden",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <NavContent collapsed={false} onNavigate={() => setMobileNavOpen(false)} />
      </aside>

      <div
        className={cn(
          "min-h-screen transition-[padding] duration-200",
          sidebarCollapsed ? "lg:pl-[64px]" : "lg:pl-[220px]"
        )}
      >
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/70 bg-background/92 px-4 backdrop-blur-xl lg:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 lg:hidden"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
            <div className="hidden items-center gap-1.5 text-[12px] sm:flex">
              <span className="text-muted-foreground">
                {user?.businessName || "Superblock HQ"}
              </span>
              {breadcrumbs?.map((item, index) => (
                <span
                  key={`${item}-${index}`}
                  className="flex items-center gap-1.5"
                >
                  <span className="text-muted-foreground/50">/</span>
                  <span
                    className={
                      index === breadcrumbs.length - 1
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    {item}
                  </span>
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="header-search" onClick={() => setSearchOpen(true)}>
              <Search className="size-3.5" />
              <span className="hidden sm:inline">Search workspace</span>
              <kbd className="ml-auto hidden rounded border bg-background px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground md:block">
                ⌘ K
              </kbd>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative size-8 cursor-pointer"
                >
                  <Bell className="size-4" />
                  {notifications.length > 0 && (
                    <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between text-xs">
                  Notifications{" "}
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {notifications.length > 0 ? `${notifications.length} alerts` : "All caught up"}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length > 0 ? (
                  notifications.map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      className="items-start gap-2 py-2.5 cursor-pointer"
                      onClick={() => navigate(item.href)}
                    >
                      <span
                        className={cn(
                          "mt-1.5 size-2 rounded-full",
                          item.type === "danger" ? "bg-rose-500" : "bg-primary"
                        )}
                      />
                      <div>
                        <div className="text-xs leading-5 font-medium">{item.title}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {item.detail}
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No new notifications
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 gap-2 px-1.5 cursor-pointer"
                >
                  <Avatar initials={user?.initials || "SB"} size="sm" />
                  <ChevronDown className="hidden size-3 text-muted-foreground sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-xs font-medium">
                    {user?.username || "Superblock User"}
                  </div>
                  <div className="text-[11px] font-normal text-muted-foreground truncate">
                    {user?.email || user?.businessName || "Superblock Workspace"}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="cursor-pointer"
                >
                  {theme === "dark" ? (
                    <Sun className="size-3.5" />
                  ) : (
                    <Moon className="size-3.5" />
                  )}
                  Switch to {theme === "dark" ? "light" : "dark"}
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/settings">
                    <Settings className="size-3.5" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="text-rose-600 dark:text-rose-400 cursor-pointer focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/20"
                >
                  <LogOut className="size-3.5" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1660px] p-4 sm:p-5 xl:p-6">
          {children}
        </main>
      </div>
      <GlobalSearch />
    </div>
  );
}
