import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  CheckCircle2,
  ChevronRight,
  Copy,
  CreditCard,
  Download,
  Edit2,
  FileText,
  Loader2,
  MoreHorizontal,
  PackageOpen,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  Avatar,
  PageHeader,
  SectionHeader,
  StatusBadge,
  TableSearch,
  downloadCsv,
} from "@/components/dashboard-ui";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

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
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  type ProductItem,
} from "@/lib/api/products";
import {
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  type PlanItem,
} from "@/lib/api/plans";
import {
  getSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  type SubscriptionItem,
} from "@/lib/api/subscriptions";
import {
  getTeamMembers,
  inviteTeamMember,
  updateTeamMember,
  deleteTeamMember,
  type TeamMemberItem,
} from "@/lib/api/team";
import { useCustomerAnalytics } from "@/lib/api/customerAnalytics";
import { toast } from "sonner";

// ============================================================================
// 1. PRODUCTS & PLANS
// ============================================================================
export function ProductsPlans() {
  const [tab, setTab] = useState<"products" | "plans">("products");
  const [productsList, setProductsList] = useState<ProductItem[]>([]);
  const [plansList, setPlansList] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog States
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    category: "Channel",
    model: "Usage based",
    status: "Active" as ProductItem["status"],
    description: "",
  });

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null);
  const [planForm, setPlanForm] = useState({
    name: "",
    product: "",
    monthly: 0,
    annual: 0,
    limit: "Standard limits",
    features: 8,
    status: "Active" as PlanItem["status"],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [prods, plns] = await Promise.all([getProducts(), getPlans()]);
      setProductsList(prods);
      setPlansList(plns);
    } catch (err) {
      console.warn("Failed to load products/plans:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const onUpdated = () => loadData();
    window.addEventListener("products-updated", onUpdated);
    window.addEventListener("plans-updated", onUpdated);
    return () => {
      window.removeEventListener("products-updated", onUpdated);
      window.removeEventListener("plans-updated", onUpdated);
    };
  }, []);

  // Product Actions
  const handleOpenCreateProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: "",
      category: "Channel",
      model: "Usage based",
      status: "Active",
      description: "",
    });
    setProductDialogOpen(true);
  };

  const handleOpenEditProduct = (p: ProductItem) => {
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      category: p.category,
      model: p.model,
      status: p.status,
      description: p.description || "",
    });
    setProductDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!productForm.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, productForm);
        toast.success("Product updated", { description: `${productForm.name} changes saved.` });
      } else {
        await createProduct({
          ...productForm,
          plans: 1,
          customers: 0,
        });
        toast.success("Product created", { description: `${productForm.name} added to catalog.` });
      }
      setProductDialogOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save product");
    }
  };

  const handleDuplicateProduct = async (p: ProductItem) => {
    try {
      await createProduct({
        ...p,
        id: undefined,
        name: `${p.name} (Copy)`,
        customers: 0,
      });
      toast.success("Product duplicated", { description: `Created copy of ${p.name}.` });
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to duplicate product");
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    try {
      await deleteProduct(id);
      toast.success("Product archived", { description: `${name} has been removed from catalog.` });
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to archive product");
    }
  };

  // Plan Actions
  const handleOpenCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm({
      name: "",
      product: productsList[0]?.name || "",
      monthly: 0,
      annual: 0,
      limit: "Standard limits",
      features: 8,
      status: "Active",
    });
    setPlanDialogOpen(true);
  };

  const handleOpenEditPlan = (p: PlanItem) => {
    setEditingPlan(p);
    setPlanForm({
      name: p.name,
      product: p.product,
      monthly: p.monthly,
      annual: p.annual,
      limit: p.limit,
      features: p.features,
      status: p.status,
    });
    setPlanDialogOpen(true);
  };

  const handleSavePlan = async () => {
    if (!planForm.name.trim()) {
      toast.error("Plan name is required");
      return;
    }
    try {
      if (editingPlan) {
        await updatePlan(editingPlan.id, planForm);
        toast.success("Plan updated", { description: `${planForm.name} has been saved.` });
      } else {
        await createPlan(planForm);
        toast.success("Plan created", { description: `${planForm.name} added to catalog.` });
      }
      setPlanDialogOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save plan");
    }
  };

  const handleDuplicatePlan = async (p: PlanItem) => {
    try {
      await createPlan({
        ...p,
        id: undefined,
        name: `${p.name} (Copy)`,
      });
      toast.success("Plan duplicated", { description: `Created copy of ${p.name}.` });
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to duplicate plan");
    }
  };

  const handleDeletePlan = async (id: string, name: string) => {
    try {
      await deletePlan(id);
      toast.success("Plan archived", { description: `${name} has been removed.` });
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to archive plan");
    }
  };

  return (
    <AppShell breadcrumbs={["Billing", "Products & Plans"]}>
      <PageHeader
        eyebrow="Billing catalog"
        title="Products & Plans"
        description="Define commercial software products, packaging tiers, and feature limits."
        actions={
          <Button
            size="sm"
            onClick={tab === "products" ? handleOpenCreateProduct : handleOpenCreatePlan}
          >
            <Plus className="size-3.5" />
            Create {tab === "products" ? "product" : "plan"}
          </Button>
        }
      />

      <div className="mt-4 flex gap-1 border-b">
        <button
          className={`tab-button ${tab === "products" ? "active" : ""}`}
          onClick={() => setTab("products")}
        >
          Products <span>{productsList.length}</span>
        </button>
        <button
          className={`tab-button ${tab === "plans" ? "active" : ""}`}
          onClick={() => setTab("plans")}
        >
          Plans <span>{plansList.length}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : tab === "products" ? (
        productsList.length === 0 ? (
          <div className="mt-4 panel p-8 text-center">
            <p className="text-xs text-muted-foreground">No commercial products registered in catalog.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {productsList.map((item) => {
              const matchedPlansCount = plansList.filter(
                (p) => (p.product || "").toLowerCase() === (item.name || "").toLowerCase()
              ).length;
              return (
                <div className="panel group p-4" key={item.id}>
                  <div className="flex items-start justify-between">
                    <span className="grid size-9 place-items-center rounded-lg border bg-muted/35">
                      <PackageOpen className="size-4" />
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenEditProduct(item)}>
                          Edit product
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateProduct(item)}>
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-rose-600"
                          onClick={() => handleDeleteProduct(item.id, item.name)}
                        >
                          Archive product
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold">{item.name}</h3>
                  <p className="mt-1 h-10 text-[11px] leading-5 text-muted-foreground">
                    {item.description || `${item.category} capabilities billed through a ${item.model.toLowerCase()} model.`}
                  </p>
                  <div className="mt-4 grid grid-cols-2 border-t pt-3 text-[11px]">
                    <div>
                      <span className="text-muted-foreground">Customers</span>
                      <b className="mt-1 block font-tabular text-sm">{formatNumber(item.customers || 0)}</b>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Plans</span>
                      <b className="mt-1 block font-tabular text-sm">{matchedPlansCount}</b>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <StatusBadge status={item.status} />
                    <span className="text-[10px] text-muted-foreground">{item.model}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="mt-4 panel overflow-hidden">
          <div className="p-4 pb-2">
            <SectionHeader
              title="Plan catalog"
              description="Pricing tiers, usage limits, and commercial packaging"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[850px]">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Product</th>
                  <th className="text-right">Monthly</th>
                  <th className="text-right">Annual</th>
                  <th>Usage limit</th>
                  <th className="text-right">Features</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {plansList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-muted-foreground">
                      No commercial plans registered in catalog.
                    </td>
                  </tr>
                ) : (
                  plansList.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium">{item.name}</td>
                    <td>{item.product}</td>
                    <td className="text-right font-tabular">
                      {item.monthly ? formatCurrency(item.monthly) : "Custom"}
                    </td>
                    <td className="text-right font-tabular">
                      {item.annual ? formatCurrency(item.annual) : "Custom"}
                    </td>
                    <td>{item.limit}</td>
                    <td className="text-right font-tabular">{item.features}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEditPlan(item)}>
                            Edit plan
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicatePlan(item)}>
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-rose-600"
                            onClick={() => handleDeletePlan(item.id, item.name)}
                          >
                            Archive plan
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Product Create/Edit Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit product" : "Create product"}</DialogTitle>
            <DialogDescription>
              {editingProduct
                ? `Update commercial attributes for ${editingProduct.name}.`
                : "Add a new software offering to the Superblock catalog."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Product name</Label>
              <Input
                placeholder="e.g. Omnichannel Automation"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Category</Label>
                <Select
                  value={productForm.category}
                  onValueChange={(val) => setProductForm({ ...productForm, category: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Channel">Channel</SelectItem>
                    <SelectItem value="Collaboration">Collaboration</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="AI & Automation">AI & Automation</SelectItem>
                    <SelectItem value="CRM">CRM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Billing model</Label>
                <Select
                  value={productForm.model}
                  onValueChange={(val) => setProductForm({ ...productForm, model: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Usage based">Usage based</SelectItem>
                    <SelectItem value="Per seat">Per seat</SelectItem>
                    <SelectItem value="Tiered usage">Tiered usage</SelectItem>
                    <SelectItem value="Outcome + usage">Outcome + usage</SelectItem>
                    <SelectItem value="Flat fee">Flat fee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Status</Label>
              <Select
                value={productForm.status}
                onValueChange={(val: any) => setProductForm({ ...productForm, status: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Beta">Beta</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                rows={3}
                placeholder="Capabilities and commercial parameters..."
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProduct}>
              {editingProduct ? "Save changes" : "Create product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan Create/Edit Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit plan" : "Create plan"}</DialogTitle>
            <DialogDescription>
              {editingPlan
                ? `Update commercial parameters for ${editingPlan.name}.`
                : "Create a subscription tier with custom pricing and limits."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Plan name</Label>
              <Input
                placeholder="e.g. Growth Pro"
                value={planForm.name}
                onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Parent product</Label>
              <Select
                value={planForm.product}
                onValueChange={(val) => setPlanForm({ ...planForm, product: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {productsList.map((p) => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="Omnichannel Suite">Omnichannel Suite</SelectItem>
                  <SelectItem value="Custom bundle">Custom bundle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Monthly price (₹)</Label>
                <Input
                  type="number"
                  value={planForm.monthly}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      monthly: Number(e.target.value),
                      annual: Math.round(Number(e.target.value) * 10.2),
                    })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Annual price (₹)</Label>
                <Input
                  type="number"
                  value={planForm.annual}
                  onChange={(e) => setPlanForm({ ...planForm, annual: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Usage limit</Label>
                <Input
                  placeholder="e.g. 50k broadcasts"
                  value={planForm.limit}
                  onChange={(e) => setPlanForm({ ...planForm, limit: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Features count</Label>
                <Input
                  type="number"
                  value={planForm.features}
                  onChange={(e) => setPlanForm({ ...planForm, features: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Status</Label>
              <Select
                value={planForm.status}
                onValueChange={(val: any) => setPlanForm({ ...planForm, status: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Private">Private</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePlan}>
              {editingPlan ? "Save changes" : "Create plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// ============================================================================
// 2. SUBSCRIPTIONS
// ============================================================================
export function Subscriptions() {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [subscriptionsList, setSubscriptionsList] = useState<SubscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<SubscriptionItem | null>(null);

  const { customers: apiCustomers } = useCustomerAnalytics();

  const [form, setForm] = useState({
    customer: "",
    customerId: "",
    plan: "Growth",
    cycle: "Annual",
    mrr: 0,
    status: "Active",
    autoRenewal: true,
  });

  const loadSubs = async () => {
    setLoading(true);
    try {
      const data = await getSubscriptions();
      setSubscriptionsList(data);
    } catch (err) {
      console.warn("Could not load subscriptions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubs();
    const onUpdated = () => loadSubs();
    window.addEventListener("subscriptions-updated", onUpdated);
    return () => window.removeEventListener("subscriptions-updated", onUpdated);
  }, []);

  const filtered = useMemo(() => {
    return subscriptionsList.filter((item) => {
      const isRenewalDue =
        item.status === "Renewal Due" ||
        (new Date(item.renewalDate).getTime() > Date.now() &&
          new Date(item.renewalDate).getTime() <= Date.now() + 30 * 86400000);
      const matchesFilter =
        filter === "All" ||
        item.status === filter ||
        (filter === "Renewal Due" && isRenewalDue);
      return (
        matchesFilter &&
        (item.customer || "").toLowerCase().includes(query.toLowerCase())
      );
    });
  }, [subscriptionsList, filter, query]);

  const handleOpenCreate = () => {
    const defaultCust = apiCustomers[0];
    setEditingSub(null);
    setForm({
      customer: defaultCust?.company || "",
      customerId: defaultCust?.id || "",
      plan: "Growth",
      cycle: "Annual",
      mrr: 0,
      status: "Active",
      autoRenewal: true,
    });
    setCreateDialogOpen(true);
  };

  const handleSaveSubscription = async () => {
    if (!form.customer.trim()) {
      toast.error("Customer name is required");
      return;
    }
    try {
      if (editingSub) {
        await updateSubscription(editingSub.id, {
          plan: form.plan,
          cycle: form.cycle,
          mrr: form.mrr,
          amount: form.cycle === "Annual" ? form.mrr * 12 : form.mrr,
          status: form.status,
          autoRenewal: form.autoRenewal,
        });
        toast.success("Subscription updated", { description: `${form.customer} subscription saved.` });
      } else {
        await createSubscription({
          customer: form.customer,
          customerId: form.customerId || `CUS-${Date.now().toString().slice(-5)}`,
          plan: form.plan,
          cycle: form.cycle,
          mrr: form.mrr,
          amount: form.cycle === "Annual" ? form.mrr * 12 : form.mrr,
          status: form.status,
          payment: "Paid",
          autoRenewal: form.autoRenewal,
        });
        toast.success("Subscription created", { description: `New subscription for ${form.customer} recorded.` });
      }
      setCreateDialogOpen(false);
      await loadSubs();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save subscription");
    }
  };

  const handleToggleAutoRenew = async (sub: SubscriptionItem, checked: boolean) => {
    try {
      await updateSubscription(sub.id, { autoRenewal: checked });
      toast.success("Auto-renewal preference updated", {
        description: `${sub.customer} auto-renewal is now ${checked ? "enabled" : "disabled"}.`,
      });
      await loadSubs();
    } catch (err) {
      toast.error("Failed to update auto-renewal");
    }
  };

  const handleRenewNow = async (sub: SubscriptionItem) => {
    try {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      await updateSubscription(sub.id, {
        status: "Active",
        payment: "Paid",
        renewalDate: nextYear.toISOString().split("T")[0],
      });
      toast.success("Subscription renewed", {
        description: `${sub.customer} contract extended for 1 year.`,
      });
      await loadSubs();
    } catch (err) {
      toast.error("Failed to renew subscription");
    }
  };

  const handleCancelSub = async (sub: SubscriptionItem) => {
    try {
      await updateSubscription(sub.id, { status: "Cancelled", autoRenewal: false });
      toast.success("Subscription cancelled", {
        description: `${sub.customer} subscription marked as cancelled.`,
      });
      await loadSubs();
    } catch (err) {
      toast.error("Failed to cancel subscription");
    }
  };

  const exportRows = () => {
    downloadCsv(
      "subscriptions.csv",
      filtered as unknown as Record<string, string | number | boolean>[]
    );
    toast.success("Subscriptions exported", {
      description: "CSV downloaded to your device.",
    });
  };

  const activeSubsCount = subscriptionsList.filter((s) => s.status === "Active").length;
  const totalMrr = subscriptionsList.reduce((acc, s) => acc + (s.mrr || 0), 0);
  const renewingSoonCount = subscriptionsList.filter((s) => {
    const status = (s.status || "").toLowerCase();
    if (status === "renewal due" || status === "renewal_due") return true;
    const d = new Date(s.renewalDate).getTime();
    return !isNaN(d) && d >= Date.now() && d <= Date.now() + 30 * 86400000;
  }).length;
  const pastDueCount = subscriptionsList.filter((s) => s.status === "Past due").length;

  return (
    <AppShell breadcrumbs={["Billing", "Subscriptions"]}>
      <PageHeader
        eyebrow="Billing operations"
        title="Subscriptions"
        description="Manage recurring contracts, upcoming renewals, payment state, and plan changes."
        actions={
          <Button size="sm" onClick={handleOpenCreate}>
            <Plus className="size-3.5" />
            Create subscription
          </Button>
        }
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Active subscriptions", activeSubsCount.toString(), `${subscriptionsList.length} total contracts`, CreditCard],
          ["MRR", formatCurrency(totalMrr), activeSubsCount > 0 ? "Normalized monthly recurring" : "No active revenue", CheckCircle2],
          ["Renewing soon", renewingSoonCount.toString(), renewingSoonCount > 0 ? "Upcoming in 30 days" : "None in next 30 days", ShieldCheck],
          ["Past due", pastDueCount.toString(), pastDueCount > 0 ? "Requires review" : "No past due accounts", XCircle],
        ].map(([l, v, d, I]) => (
          <div className="metric-card" key={l as string}>
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{l as string}</span>
              <I className="size-3.5" />
            </div>
            <div className="mt-4 font-tabular text-2xl font-semibold">{v as string}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{d as string}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 panel overflow-hidden">
        <TableSearch
          value={query}
          onChange={setQuery}
          placeholder="Search subscriptions by customer…"
          actions={
            <>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="h-8 w-[135px] bg-card text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["All", "Active", "Trial", "Renewal Due", "Past due"].map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        <div className="overflow-x-auto">
          <table className="data-table min-w-[1050px]">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Start date</th>
                <th>Renewal</th>
                <th>Cycle</th>
                <th className="text-right">MRR</th>
                <th className="text-right">Contract</th>
                <th>Payment</th>
                <th>Auto renew</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-xs text-muted-foreground">
                    Loading subscriptions…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-xs text-muted-foreground">
                    No subscriptions recorded.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link
                        href={`/customers/${item.customerId}`}
                        className="font-medium hover:underline"
                      >
                        {item.customer}
                      </Link>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {item.customerId}
                      </div>
                    </td>
                    <td>{item.plan}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>{item.startDate}</td>
                    <td>{item.renewalDate}</td>
                    <td>{item.cycle}</td>
                    <td className="text-right font-tabular font-medium">
                      {formatCurrency(item.mrr)}
                    </td>
                    <td className="text-right font-tabular">{formatCurrency(item.amount)}</td>
                    <td>
                      <StatusBadge status={item.payment} />
                    </td>
                    <td>
                      <Switch
                        checked={item.autoRenewal}
                        onCheckedChange={(checked) => handleToggleAutoRenew(item, checked)}
                      />
                    </td>
                    <td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingSub(item);
                              setForm({
                                customer: item.customer,
                                customerId: item.customerId,
                                plan: item.plan,
                                cycle: item.cycle,
                                mrr: item.mrr,
                                status: item.status,
                                autoRenewal: item.autoRenewal,
                              });
                              setCreateDialogOpen(true);
                            }}
                          >
                            Change plan
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRenewNow(item)}>
                            Renew now
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/customers/${item.customerId}`}>View customer</Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-rose-600"
                            onClick={() => handleCancelSub(item)}
                          >
                            Cancel subscription
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subscription Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingSub ? "Edit subscription" : "Create subscription"}
            </DialogTitle>
            <DialogDescription>
              {editingSub
                ? `Update recurring commercial terms for ${editingSub.customer}.`
                : "Create a new commercial software contract."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Customer</Label>
              {editingSub ? (
                <Input value={form.customer} disabled />
              ) : (
                <Select
                  value={form.customerId}
                  onValueChange={(val) => {
                    const c = apiCustomers.find((item) => item.id === val);
                    setForm({
                      ...form,
                      customerId: val,
                      customer: c?.company || val,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {apiCustomers.slice(0, 30).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company} ({c.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Plan tier</Label>
                <Select
                  value={form.plan}
                  onValueChange={(val) => setForm({ ...form, plan: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Starter">Starter</SelectItem>
                    <SelectItem value="Growth">Growth</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                    <SelectItem value="Enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Billing cycle</Label>
                <Select
                  value={form.cycle}
                  onValueChange={(val) => setForm({ ...form, cycle: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Annual">Annual</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">MRR (₹)</Label>
                <Input
                  type="number"
                  value={form.mrr}
                  onChange={(e) => setForm({ ...form, mrr: Number(e.target.value) })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(val) => setForm({ ...form, status: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Trial">Trial</SelectItem>
                    <SelectItem value="Renewal Due">Renewal Due</SelectItem>
                    <SelectItem value="Past due">Past due</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-xs font-medium">Automatic renewal</div>
                <div className="text-[11px] text-muted-foreground">
                  Charge contract renewal on expiry.
                </div>
              </div>
              <Switch
                checked={form.autoRenewal}
                onCheckedChange={(checked) => setForm({ ...form, autoRenewal: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSubscription}>
              {editingSub ? "Save changes" : "Create contract"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// ============================================================================
// 3. INVOICES
// ============================================================================
export function Invoices() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [invoicesList, setInvoicesList] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { customers: apiCustomers } = useCustomerAnalytics();

  const [form, setForm] = useState({
    customerId: "",
    customer: "",
    product: "",
    amount: 0,
    status: "Sent",
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
  });

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/invoices");
      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data?.invoices)) {
          setInvoicesList(data.invoices);
          try {
            localStorage.setItem("sb_invoices_all", JSON.stringify(data.invoices));
          } catch {}
          return;
        }
      }
    } catch (err) {
      console.warn("Could not load invoices from server:", err);
    } finally {
      setLoading(false);
    }

    try {
      const cached = localStorage.getItem("sb_invoices_all");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setInvoicesList(parsed);
        }
      }
    } catch {}
  };

  useEffect(() => {
    loadInvoices();

    const handleInvoiceEvent = () => {
      loadInvoices();
    };

    window.addEventListener("customer-invoice-created", handleInvoiceEvent);
    window.addEventListener("customer-operations-updated", handleInvoiceEvent);

    return () => {
      window.removeEventListener("customer-invoice-created", handleInvoiceEvent);
      window.removeEventListener("customer-operations-updated", handleInvoiceEvent);
    };
  }, []);

  const filtered = useMemo(() => {
    return invoicesList.filter(
      (x) =>
        (status === "All statuses" || x.status === status) &&
        `${x.id || ""} ${x.customer || ""} ${x.product || ""}`.toLowerCase().includes(query.toLowerCase())
    );
  }, [invoicesList, status, query]);

  const handleOpenCreate = () => {
    const c = apiCustomers[0];
    setForm({
      customerId: c?.id || "",
      customer: c?.company || "",
      product: "",
      amount: 0,
      status: "Sent",
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
    });
    setCreateDialogOpen(true);
  };

  const handleSaveInvoice = async () => {
    if (!form.customer.trim()) {
      toast.error("Customer name is required");
      return;
    }
    const totalAmount = Number(form.amount) || 0;
    const tax = Math.round(totalAmount * 0.18);
    const invId = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newInv = {
      id: invId,
      invoice_number: invId,
      customerId: form.customerId,
      customer_id: form.customerId,
      customer: form.customer,
      customer_name: form.customer,
      product: form.product,
      description: form.product,
      date: new Date().toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }),
      issue_date: new Date().toISOString().split("T")[0],
      dueDate: form.dueDate,
      due_date: form.dueDate,
      amount: totalAmount,
      tax: tax,
      total: totalAmount + tax,
      status: form.status,
    };

    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newInv),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        const created = data.invoice || newInv;
        toast.success("Invoice created", { description: `${created.id || newInv.id} issued for ${created.customer || newInv.customer}.` });
        setCreateDialogOpen(false);
        setInvoicesList((prev) => [created, ...prev.filter((i) => i.id !== created.id)]);
        window.dispatchEvent(
          new CustomEvent("customer-invoice-created", {
            detail: { customerId: form.customerId, invoice: created },
          })
        );
        await loadInvoices();
      } else {
        throw new Error(data?.error || "Failed to create invoice");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to create invoice");
    }
  };

  const handleMarkAsPaid = async (inv: any) => {
    try {
      const res = await fetch(`/api/invoices/${inv.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Paid", paymentDate: new Date().toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }) }),
      });
      if (res.ok) {
        toast.success("Invoice marked as paid", { description: `${inv.id} marked as Paid.` });
        setSelected(null);
        await loadInvoices();
      }
    } catch (err) {
      toast.error("Failed to update invoice");
    }
  };

  const exportRows = () => {
    downloadCsv(
      "invoices.csv",
      filtered.map((x) => ({
        Invoice: x.id,
        Customer: x.customer,
        Date: x.date,
        Total: x.total,
        Status: x.status,
      }))
    );
    toast.success("Invoices exported");
  };

  return (
    <AppShell breadcrumbs={["Billing", "Invoices"]}>
      <PageHeader
        eyebrow="Billing operations"
        title="Invoices"
        description="Track issued, paid, overdue, and cancelled customer invoices."
        actions={
          <Button size="sm" onClick={handleOpenCreate}>
            <Plus className="size-3.5" />
            Create invoice
          </Button>
        }
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Total billed", formatCurrency(invoicesList.reduce((a, b) => a + (b.total || 0), 0)), `${invoicesList.length} total issued`],
          ["Collected", formatCurrency(invoicesList.filter((i) => i.status === "Paid").reduce((a, b) => a + (b.total || 0), 0)), "Settled"],
          ["Outstanding", formatCurrency(invoicesList.filter((i) => i.status === "Sent").reduce((a, b) => a + (b.total || 0), 0)), `${invoicesList.filter((i) => i.status === "Sent").length} invoices`],
          ["Overdue", formatCurrency(invoicesList.filter((i) => i.status === "Overdue").reduce((a, b) => a + (b.total || 0), 0)), `${invoicesList.filter((i) => i.status === "Overdue").length} invoices`],
        ].map(([l, v, d]) => (
          <div className="metric-card" key={l}>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {l}
            </div>
            <div className="mt-4 font-tabular text-2xl font-semibold">{v}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{d}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 panel overflow-hidden">
        <TableSearch
          value={query}
          onChange={setQuery}
          placeholder="Search invoice or customer…"
          actions={
            <>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 w-[140px] bg-card text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["All statuses", "Draft", "Sent", "Paid", "Overdue", "Cancelled"].map((x) => (
                    <SelectItem value={x} key={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        <div className="overflow-x-auto">
          <table className="data-table min-w-[1000px]">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Due date</th>
                <th>Product</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Tax</th>
                <th className="text-right">Total</th>
                <th>Status</th>
                <th>Payment date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-xs text-muted-foreground">
                    Loading invoices…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-xs text-muted-foreground">
                    No invoices recorded.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={`${item.customerId}-${item.id}`}>
                    <td className="font-mono text-[11px]">{item.id}</td>
                    <td>
                      <Link
                        href={`/customers/${item.customerId}`}
                        className="font-medium hover:underline"
                      >
                        {item.customer}
                      </Link>
                    </td>
                    <td>{item.date}</td>
                    <td>{item.dueDate}</td>
                    <td>{item.product}</td>
                    <td className="text-right font-tabular">{formatCurrency(item.amount)}</td>
                    <td className="text-right font-tabular">{formatCurrency(item.tax)}</td>
                    <td className="text-right font-tabular font-medium">
                      {formatCurrency(item.total)}
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>{item.paymentDate || "—"}</td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => setSelected(item)}
                      >
                        View <ChevronRight className="size-3" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Invoice {selected?.id}</DialogTitle>
            <DialogDescription>
              {selected?.customer} · {selected?.product}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div>
              <div className="rounded-xl bg-foreground p-5 text-background">
                <div className="text-[10px] uppercase tracking-wider opacity-60">Total due</div>
                <div className="mt-2 text-3xl font-semibold">{formatCurrency(selected.total)}</div>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span>Due {selected.dueDate}</span>
                  <StatusBadge status={selected.status} />
                </div>
              </div>
              <div className="mt-4 divide-y rounded-lg border text-xs">
                {[
                  ["Subtotal", formatCurrency(selected.amount)],
                  ["Tax (18% GST)", formatCurrency(selected.tax)],
                  ["Total", formatCurrency(selected.total)],
                ].map(([l, v]) => (
                  <div className="flex justify-between p-3" key={l}>
                    <span className="text-muted-foreground">{l}</span>
                    <b>{v}</b>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between gap-2">
                {selected.status !== "Paid" && (
                  <Button variant="outline" onClick={() => handleMarkAsPaid(selected)}>
                    Mark as Paid
                  </Button>
                )}
                <div className="ml-auto flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      downloadCsv(`invoice-${selected.id}.csv`, [selected]);
                      toast.success("Invoice downloaded", { description: `${selected.id}.csv ready.` });
                    }}
                  >
                    <Download className="size-4" />
                    Download
                  </Button>
                  <Button onClick={() => setSelected(null)}>Close</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Invoice Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Create invoice</DialogTitle>
            <DialogDescription>Issue a new invoice to a customer account.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Customer</Label>
              <Select
                value={form.customerId}
                onValueChange={(val) => {
                  const c = apiCustomers.find((item) => item.id === val);
                  setForm({
                    ...form,
                    customerId: val,
                    customer: c?.company || val,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {apiCustomers.slice(0, 30).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company} ({c.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Product description</Label>
              <Input
                placeholder="e.g. Omnichannel Suite Annual"
                value={form.product}
                onChange={(e) => setForm({ ...form, product: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Amount (₹)</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(val) => setForm({ ...form, status: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sent">Sent</SelectItem>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Due date</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveInvoice}>Issue invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// ============================================================================
// 4. TEAM
// ============================================================================
export function Team() {
  const [query, setQuery] = useState("");
  const [teamList, setTeamList] = useState<TeamMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMemberItem | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "Customer Success",
    department: "Customer",
  });

  const loadTeam = async () => {
    setLoading(true);
    try {
      const data = await getTeamMembers();
      setTeamList(data);
    } catch (err) {
      console.warn("Could not load team members:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeam();
    const onUpdated = () => loadTeam();
    window.addEventListener("team-updated", onUpdated);
    return () => window.removeEventListener("team-updated", onUpdated);
  }, []);

  const rows = useMemo(() => {
    return teamList.filter((x) =>
      `${x.name} ${x.email} ${x.role} ${x.department}`.toLowerCase().includes(query.toLowerCase())
    );
  }, [teamList, query]);

  const handleOpenInvite = () => {
    setEditingMember(null);
    setForm({
      name: "",
      email: "",
      role: "Customer Success",
      department: "Customer",
    });
    setInviteDialogOpen(true);
  };

  const handleSaveMember = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    try {
      if (editingMember) {
        await updateTeamMember(editingMember.id, {
          name: form.name,
          email: form.email,
          role: form.role,
          department: form.department,
        });
        toast.success("Team member updated", { description: `${form.name} details saved.` });
      } else {
        await inviteTeamMember(form);
        toast.success("Invitation sent", { description: `Invitation sent to ${form.email}.` });
      }
      setInviteDialogOpen(false);
      await loadTeam();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save team member");
    }
  };

  const handleToggleStatus = async (m: TeamMemberItem) => {
    const nextStatus = m.status === "Active" ? "Disabled" : "Active";
    try {
      await updateTeamMember(m.id, { status: nextStatus });
      toast.success(`Member ${nextStatus === "Active" ? "enabled" : "disabled"}`, {
        description: `${m.name} is now ${nextStatus.toLowerCase()}.`,
      });
      await loadTeam();
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (m: TeamMemberItem) => {
    try {
      await deleteTeamMember(m.id);
      toast.success("Member removed", { description: `${m.name} removed from workspace.` });
      await loadTeam();
    } catch (err) {
      toast.error("Failed to remove member");
    }
  };

  return (
    <AppShell breadcrumbs={["Workspace", "Team"]}>
      <PageHeader
        eyebrow="Workspace"
        title="Team"
        description="Manage internal member access, roles, departments, and customer assignments."
        actions={
          <Button size="sm" onClick={handleOpenInvite}>
            <Plus className="size-3.5" />
            Invite member
          </Button>
        }
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="metric-card">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Active members
          </div>
          <div className="mt-3 font-tabular text-2xl font-semibold">
            {teamList.filter((m) => m.status === "Active").length}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Across {new Set(teamList.map((m) => m.role)).size} roles
          </div>
        </div>
        <div className="metric-card">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Customer owners
          </div>
          <div className="mt-3 font-tabular text-2xl font-semibold">
            {teamList.filter((m) => m.customers > 0).length}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {teamList.reduce((acc, m) => acc + (m.customers || 0), 0)} customer accounts assigned
          </div>
        </div>
        <div className="metric-card">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Departments
          </div>
          <div className="mt-3 font-tabular text-2xl font-semibold">
            {new Set(teamList.map((m) => m.department).filter((d) => d && d !== "—")).size}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">Active organizational units</div>
        </div>
      </div>

      <div className="mt-4 panel overflow-hidden">
        <TableSearch
          value={query}
          onChange={setQuery}
          placeholder="Search team members by name or role…"
        />
        <div className="overflow-x-auto">
          <table className="data-table min-w-[850px]">
            <thead>
              <tr>
                <th>Member</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th className="text-right">Customers</th>
                <th>Status</th>
                <th>Last active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-muted-foreground">
                    Loading team members…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-muted-foreground">
                    No team members recorded.
                  </td>
                </tr>
              ) : (
                rows.map((item) => (
                  <tr key={item.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={item.initials} />
                      <span className="font-medium">{item.name}</span>
                    </div>
                  </td>
                  <td>{item.email}</td>
                  <td>
                    <span className="rounded-md border bg-muted/30 px-2 py-1 text-[11px] font-medium">
                      {item.role}
                    </span>
                  </td>
                  <td>{item.department}</td>
                  <td className="text-right font-tabular">{item.customers}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                  <td>{item.lastActive}</td>
                  <td>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingMember(item);
                            setForm({
                              name: item.name,
                              email: item.email,
                              role: item.role,
                              department: item.department,
                            });
                            setInviteDialogOpen(true);
                          }}
                        >
                          Edit details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(item)}>
                          {item.status === "Active" ? "Disable access" : "Activate access"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-rose-600"
                          onClick={() => handleDelete(item)}
                        >
                          Remove member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          </table>
        </div>
      </div>

      {/* Invite/Edit Member Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {editingMember ? "Edit team member" : "Invite team member"}
            </DialogTitle>
            <DialogDescription>
              {editingMember
                ? `Update role and organizational permissions for ${editingMember.name}.`
                : "Grant internal access to this Superblock Insight workspace."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Full name</Label>
              <Input
                placeholder="e.g. Maya Iyer"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Corporate email</Label>
              <Input
                type="email"
                placeholder="maya@superblock.chat"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(val) => setForm({ ...form, role: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Customer Success">Customer Success</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Support">Support</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="Analyst">Analyst</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Department</Label>
                <Select
                  value={form.department}
                  onValueChange={(val) => setForm({ ...form, department: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Customer">Customer</SelectItem>
                    <SelectItem value="Revenue">Revenue</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="Engineering">Engineering</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMember}>
              {editingMember ? "Save changes" : "Send invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
