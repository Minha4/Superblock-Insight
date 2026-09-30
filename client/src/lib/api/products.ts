export interface ProductItem {
  id: string;
  name: string;
  category: string;
  model: string;
  status: "Active" | "Private" | "Archived";
  plans: number;
  customers: number;
  description: string;
  price: number;
  createdAt: string;
  updatedAt?: string;
}

const STORAGE_KEY = "analytics_studio_custom_products";

const DEFAULT_PRODUCTS: ProductItem[] = [
  {
    id: "prod-omnichannel",
    name: "Omnichannel Suite",
    category: "Communication",
    model: "Usage based",
    status: "Active",
    plans: 4,
    customers: 24,
    description: "Complete unified communications for WhatsApp, SMS, Email, and Voice.",
    price: 3499,
    createdAt: "2024-01-15T10:00:00Z",
  },
  {
    id: "prod-ai-agents",
    name: "AI Agent Platform",
    category: "Automation",
    model: "Tiered",
    status: "Active",
    plans: 3,
    customers: 18,
    description: "Autonomous customer service bots with CRM integration and intent routing.",
    price: 5999,
    createdAt: "2024-02-01T10:00:00Z",
  },
  {
    id: "prod-analytics-pro",
    name: "Analytics Studio Pro",
    category: "Analytics",
    model: "Flat fee",
    status: "Active",
    plans: 2,
    customers: 12,
    description: "Deep funnel analytics, custom reporting, and predictive cohort tracking.",
    price: 2499,
    createdAt: "2024-03-01T10:00:00Z",
  },
];

function loadLocalProducts(): ProductItem[] {
  if (typeof window === "undefined") return DEFAULT_PRODUCTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PRODUCTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PRODUCTS;
  } catch {
    return DEFAULT_PRODUCTS;
  }
}

function saveLocalProducts(items: ProductItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn("Could not save products to localStorage:", err);
  }
}

export async function getProducts(): Promise<ProductItem[]> {
  try {
    const res = await fetch("/api/products");
    if (res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data?.products)) {
        const mappedFromDb: ProductItem[] = data.products.map((p: any) => ({
          id: p.id || `prod-${Date.now()}`,
          name: p.name || "Unnamed Product",
          category: p.category || "General",
          model: p.billing || "Usage based",
          status: p.active === false ? "Archived" : "Active",
          plans: typeof p.plans === "number" ? p.plans : 1,
          customers: typeof p.customers === "number" ? p.customers : 0,
          description: p.description || "",
          price: typeof p.price === "number" ? p.price : 0,
          createdAt: p.created_at || new Date().toISOString(),
          updatedAt: p.updated_at || new Date().toISOString(),
        }));

        saveLocalProducts(mappedFromDb);
        return mappedFromDb;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch products from backend, falling back to local storage:", err);
  }

  return loadLocalProducts();
}

export async function createProduct(input: Partial<ProductItem>): Promise<ProductItem> {
  let savedProduct: ProductItem = {
    id: input.id || `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name?.trim() || "New Product",
    category: input.category?.trim() || "General",
    model: input.model?.trim() || "Usage based",
    status: input.status || "Active",
    plans: input.plans ?? 1,
    customers: input.customers ?? 0,
    description: input.description?.trim() || `${input.category || "General"} capabilities.`,
    price: input.price ?? 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Attempt backend persistence
  try {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: savedProduct.id,
        name: savedProduct.name,
        category: savedProduct.category,
        billing: savedProduct.model,
        active: savedProduct.status !== "Archived",
        description: savedProduct.description,
        price: savedProduct.price,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.product) {
        savedProduct = {
          id: data.product.id,
          name: data.product.name,
          category: data.product.category,
          model: data.product.billing,
          status: data.product.active === false ? "Archived" : "Active",
          plans: typeof data.product.plans === "number" ? data.product.plans : 1,
          customers: typeof data.product.customers === "number" ? data.product.customers : 0,
          description: data.product.description || "",
          price: typeof data.product.price === "number" ? data.product.price : 0,
          createdAt: data.product.created_at || new Date().toISOString(),
          updatedAt: data.product.updated_at || new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    console.warn("Backend POST /api/products failed (DB offline), persisting to local storage:", err);
  }

  const existing = loadLocalProducts();
  const updated = [savedProduct, ...existing.filter((p) => p.id !== savedProduct.id)];
  saveLocalProducts(updated);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("products-updated", { detail: savedProduct }));
  }

  return savedProduct;
}

export async function updateProduct(id: string, updates: Partial<ProductItem>): Promise<ProductItem> {
  const existing = loadLocalProducts();
  const target = existing.find((p) => p.id === id);

  let updatedProduct: ProductItem = {
    ...(target || {}),
    id,
    name: updates.name || target?.name || "Product",
    category: updates.category || target?.category || "General",
    model: updates.model || target?.model || "Usage based",
    status: (updates.status || target?.status || "Active") as ProductItem["status"],
    plans: updates.plans ?? target?.plans ?? 1,
    customers: updates.customers ?? target?.customers ?? 0,
    description: updates.description ?? target?.description ?? "",
    price: updates.price ?? target?.price ?? 0,
    createdAt: target?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: updatedProduct.name,
        category: updatedProduct.category,
        billing: updatedProduct.model,
        active: updatedProduct.status !== "Archived",
        description: updatedProduct.description,
        price: updatedProduct.price,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.product) {
        updatedProduct = {
          id: data.product.id,
          name: data.product.name,
          category: data.product.category,
          model: data.product.billing,
          status: data.product.active === false ? "Archived" : "Active",
          plans: typeof data.product.plans === "number" ? data.product.plans : 1,
          customers: typeof data.product.customers === "number" ? data.product.customers : 0,
          description: data.product.description || "",
          price: typeof data.product.price === "number" ? data.product.price : 0,
          createdAt: data.product.created_at || new Date().toISOString(),
          updatedAt: data.product.updated_at || new Date().toISOString(),
        };
      }
    }
  } catch (err) {
    console.warn("Backend PUT /api/products failed, persisting to local storage:", err);
  }

  const updatedList = existing.map((p) => (p.id === id ? updatedProduct : p));
  saveLocalProducts(updatedList);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("products-updated", { detail: updatedProduct }));
  }

  return updatedProduct;
}

export async function deleteProduct(id: string): Promise<boolean> {
  try {
    await fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  } catch (err) {
    console.warn("Backend DELETE /api/products failed, removing from local storage:", err);
  }

  const existing = loadLocalProducts();
  const updatedList = existing.filter((p) => p.id !== id);
  saveLocalProducts(updatedList);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("products-updated", { detail: { id } }));
  }

  return true;
}
