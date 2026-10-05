import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FileText, PackageOpen, Search, UsersRound } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useCustomerAnalytics } from "@/lib/api/customerAnalytics";

const icons = {
  Customer: UsersRound,
  Invoice: FileText,
  Product: PackageOpen,
} as const;

export interface LiveSearchItem {
  type: "Customer" | "Invoice" | "Product";
  title: string;
  detail: string;
  href: string;
}

export function GlobalSearch() {
  const { searchOpen, setSearchOpen } = useApp();
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const { customers } = useCustomerAnalytics();
  const [products, setProducts] = useState<{ id: string; name: string; category?: string; status?: string }[]>([]);
  const [invoices, setInvoices] = useState<{ id: string; invoice_number?: string; customer_name?: string; customer_id?: string; amount: number }[]>([]);

  useEffect(() => {
    if (!searchOpen) {
      setQuery("");
      return;
    }

    // Query live products
    fetch("/api/products")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.products)) {
          setProducts(data.products);
        }
      })
      .catch(() => {});

    // Query live invoices
    fetch("/api/invoices")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.invoices)) {
          setInvoices(data.invoices);
        }
      })
      .catch(() => {});
  }, [searchOpen]);

  const allItems = useMemo<LiveSearchItem[]>(() => {
    const customerItems: LiveSearchItem[] = customers.map((c) => ({
      type: "Customer",
      title: c.company,
      detail: `${c.id} · ${c.plan && c.plan !== "—" ? c.plan : "Workspace Account"}`,
      href: `/customers/${c.id}`,
    }));

    const productItems: LiveSearchItem[] = products.map((p) => ({
      type: "Product",
      title: p.name,
      detail: `${p.category || "Platform"} · ${p.status || "Active"}`,
      href: "/products",
    }));

    const invoiceItems: LiveSearchItem[] = invoices.map((inv) => ({
      type: "Invoice",
      title: inv.invoice_number || inv.id,
      detail: `${inv.customer_name || inv.customer_id || "Customer"} · ₹${Number(inv.amount || 0).toLocaleString("en-IN")}`,
      href: "/invoices",
    }));

    return [...customerItems, ...productItems, ...invoiceItems];
  }, [customers, products, invoices]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return ["Customer", "Product", "Invoice"]
        .map((type) => ({
          type,
          items: allItems.filter((item) => item.type === type).slice(0, 4),
        }))
        .filter((group) => group.items.length > 0);
    }

    const filtered = allItems.filter((item) =>
      `${item.title} ${item.detail} ${item.type}`.toLowerCase().includes(q)
    );

    return ["Customer", "Product", "Invoice"]
      .map((type) => ({
        type,
        items: filtered.filter((item) => item.type === type).slice(0, 5),
      }))
      .filter((group) => group.items.length > 0);
  }, [query, allItems]);

  return (
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogContent
        className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[620px]"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Search workspace</DialogTitle>
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="size-4 text-muted-foreground" />
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search customers, invoices, products…"
              className="h-12"
            />
          </div>
          <CommandList className="max-h-[420px] p-2">
            <CommandEmpty className="py-14 text-center text-xs text-muted-foreground">
              No results found. Try a company, invoice, or product name.
            </CommandEmpty>
            {groups.map((group, groupIndex) => (
              <div key={group.type}>
                {groupIndex > 0 && <CommandSeparator className="my-1" />}
                <CommandGroup heading={group.type}>
                  {group.items.map((item) => {
                    const Icon = icons[item.type as keyof typeof icons] || Search;
                    return (
                      <CommandItem
                        key={`${item.type}-${item.title}`}
                        value={`${item.type}-${item.title}`}
                        className="gap-3 py-2 cursor-pointer"
                        onSelect={() => {
                          navigate(item.href);
                          setSearchOpen(false);
                        }}
                      >
                        <span className="grid size-7 place-items-center rounded-md border bg-muted/40">
                          <Icon className="size-3.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium">
                            {item.title}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {item.detail}
                          </div>
                        </div>
                        <span className="ml-auto text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                          {item.type}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </div>
            ))}
          </CommandList>
          <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground">
            <span>Search across your live Superblock workspace</span>
            <div className="flex gap-2">
              <span>↑↓ Navigate</span>
              <span>↵ Open</span>
              <span>esc Close</span>
            </div>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
