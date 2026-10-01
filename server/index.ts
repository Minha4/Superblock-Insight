import express from "express";
import fs from "fs";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import {
  getCustomerActivities,
  getCustomerProducts,
  getCustomerDeals,
  getCustomerTasks,
  getCustomerTickets,
  getCustomerContactGroups,
  getCustomerOperations,
  invalidateAnalyticsCache,
} from "./analyticsDb";
import { createNoteHandler } from "./lambda/notes/createNote";
import { getNotesHandler } from "./lambda/notes/getNotes";
import { deleteNoteHandler } from "./lambda/notes/deleteNote";
import { updateNoteHandler } from "./lambda/notes/updateNote";
import { getMeetingsHandler } from "./lambda/meetings/getMeetings";
import { createMeetingHandler } from "./lambda/meetings/createMeeting";
import { deleteMeetingHandler } from "./lambda/meetings/deleteMeeting";
import { updateMeetingHandler } from "./lambda/meetings/updateMeeting";
import { getInvoicesHandler } from "./lambda/invoices/getInvoices";
import { createInvoiceHandler } from "./lambda/invoices/createInvoice";
import { updateInvoiceHandler } from "./lambda/invoices/updateInvoice";
import { deleteInvoiceHandler } from "./lambda/invoices/deleteInvoice";
import { getPlansHandler } from "./lambda/plans/getPlans";
import { createPlanHandler } from "./lambda/plans/createPlan";
import { updatePlanHandler } from "./lambda/plans/updatePlan";
import { deletePlanHandler } from "./lambda/plans/deletePlan";
import { getSubscriptionsHandler } from "./lambda/subscriptions/getSubscriptions";
import { createSubscriptionHandler } from "./lambda/subscriptions/createSubscription";
import { updateSubscriptionHandler } from "./lambda/subscriptions/updateSubscription";
import { deleteSubscriptionHandler } from "./lambda/subscriptions/deleteSubscription";
import { getProductsHandler } from "./lambda/products/getProducts";
import { createProductHandler } from "./lambda/products/createProduct";
import { updateProductHandler } from "./lambda/products/updateProduct";
import { deleteProductHandler } from "./lambda/products/deleteProduct";
import { getTeamMembersHandler } from "./lambda/teamMembers/getTeamMembers";
import { createTeamMemberHandler } from "./lambda/teamMembers/createTeamMember";
import { updateTeamMemberHandler } from "./lambda/teamMembers/updateTeamMember";
import { deleteTeamMemberHandler } from "./lambda/teamMembers/deleteTeamMember";
import { getUsageMetricsHandler } from "./lambda/usageMetrics/getUsageMetrics";
import { getCredentialsHandler } from "./lambda/credentials/getCredentials";
import { getCustomerOfferingsHandler } from "./lambda/customerOfferings/getCustomerOfferings";
import { createCustomerOfferingHandler } from "./lambda/customerOfferings/createCustomerOffering";
import { deleteCustomerOfferingHandler } from "./lambda/customerOfferings/deleteCustomerOffering";
import { customerContactsSummary } from "../client/src/data/customerContactsData";

const __filename =
  typeof import.meta !== "undefined" && import.meta.url
    ? fileURLToPath(import.meta.url)
    : "";
const __dirname =
  __filename ? path.dirname(__filename) : process.cwd();

export const app = express();

// Parse JSON payloads
app.use(express.json());

// Normalize URLs so serverless invocations matching both /api/* and /* route cleanly
app.use((req, _res, next) => {
  if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("/_")) {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }
  next();
});

// Health check endpoint for Vercel and uptime monitoring
app.get(["/api/health", "/health"], (_req, res) => {
  return res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
  });
});

// Gateway Proxy: /api/customeranalytics -> https://gateway.superblock.chat/customeranalytics
app.get("/api/customeranalytics", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeader) {
      headers.Authorization = authHeader;
    }

    const gatewayRes = await fetch("https://gateway.superblock.chat/customeranalytics", {
      method: "GET",
      headers,
    });

    const contentType = gatewayRes.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await gatewayRes.json();
      return res.status(gatewayRes.status).json(data);
    } else {
      const text = await gatewayRes.text();
      try {
        const parsed = JSON.parse(text);
        return res.status(gatewayRes.status).json(parsed);
      } catch {
        return res.status(gatewayRes.status).send(text);
      }
    }
  } catch (error: any) {
    console.error("Error proxying customeranalytics:", error);
    return res.status(500).json({ success: false, error: error?.message || "Internal server error" });
  }
});

// Gateway Proxy: /api/profile -> https://gateway.superblock.chat/profile
app.get("/api/profile", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const userId = (req.query.userId as string) || "";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeader) {
      headers.Authorization = authHeader;
    }

    const gatewayUrl = `https://gateway.superblock.chat/profile?userId=${encodeURIComponent(userId)}`;
    const gatewayRes = await fetch(gatewayUrl, {
      method: "GET",
      headers,
    });

    const contentType = gatewayRes.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await gatewayRes.json();
      return res.status(gatewayRes.status).json(data);
    }
    const text = await gatewayRes.text();
    return res.status(gatewayRes.status).send(text);
  } catch (error: any) {
    console.error("Error proxying profile:", error);
    return res.status(500).json({ success: false, error: error?.message || "Internal server error" });
  }
});

// Gateway Proxy: /api/gateway-login -> https://gateway.superblock.chat/login
app.post("/api/gateway-login", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const userId = (req.query.userId as string) || req.body?.userId || "";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeader) {
      headers.Authorization = authHeader;
    }

    const gatewayUrl = `https://gateway.superblock.chat/login?userId=${encodeURIComponent(userId)}`;
    const gatewayRes = await fetch(gatewayUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(req.body || {}),
    });

    const contentType = gatewayRes.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await gatewayRes.json();
      return res.status(gatewayRes.status).json(data);
    }
    const text = await gatewayRes.text();
    return res.status(gatewayRes.status).send(text);
  } catch (error: any) {
    console.error("Error proxying gateway login:", error);
    return res.status(500).json({ success: false, error: error?.message || "Internal server error" });
  }
});

  // Session cookie management endpoint
  app.post("/api/set-user-session", (req, res) => {
    try {
      const { userId } = req.body || {};

      if (userId) {
        res.cookie("sb_user_session", userId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
        return res.json({ success: true, userId });
      } else {
        res.clearCookie("sb_user_session", { path: "/" });
        return res.json({ success: true, userId: null });
      }
    } catch (error) {
      console.error("Error setting user session:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  });

  // Analytics Studio PostgreSQL real data endpoints
  app.get("/api/customer-activities", async (req, res) => {
    try {
      const customerId = (req.query.customerId as string) || "";
      const customerName = (req.query.customerName as string) || "";
      const activities = await getCustomerActivities(customerId, customerName);
      return res.json({ success: true, count: activities.length, activities });
    } catch (error) {
      console.error("Error fetching customer activities:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error", activities: [] });
    }
  });

  app.get("/api/customer-products", async (req, res) => {
    try {
      const customerId = (req.query.customerId as string) || "";
      const customerName = (req.query.customerName as string) || "";
      const products = await getCustomerProducts(customerId, customerName);
      return res.json({ success: true, count: products.length, products });
    } catch (error) {
      console.error("Error fetching customer products:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error", products: [] });
    }
  });

  app.get("/api/customer-deals", async (req, res) => {
    try {
      const customerId = (req.query.customerId as string) || "";
      const customerName = (req.query.customerName as string) || "";
      const deals = await getCustomerDeals(customerId, customerName);
      return res.json({ success: true, count: deals.length, deals });
    } catch (error) {
      console.error("Error fetching customer deals:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error", deals: [] });
    }
  });

  app.get("/api/customer-tasks", async (req, res) => {
    try {
      const customerId = (req.query.customerId as string) || "";
      const customerName = (req.query.customerName as string) || "";
      const tasks = await getCustomerTasks(customerId, customerName);
      return res.json({ success: true, count: tasks.length, tasks });
    } catch (error) {
      console.error("Error fetching customer tasks:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error", tasks: [] });
    }
  });

  app.get("/api/customer-tickets", async (req, res) => {
    try {
      const customerId = (req.query.customerId as string) || "";
      const customerName = (req.query.customerName as string) || "";
      const tickets = await getCustomerTickets(customerId, customerName);
      return res.json({ success: true, count: tickets.length, tickets });
    } catch (error) {
      console.error("Error fetching customer tickets:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error", tickets: [] });
    }
  });

  app.get("/api/customer-contact-groups", async (req, res) => {
    try {
      const customerId = (req.query.customerId as string) || "";
      const customerName = (req.query.customerName as string) || "";
      const groups = await getCustomerContactGroups(customerId, customerName);
      return res.json({ success: true, count: groups.length, groups });
    } catch (error) {
      console.error("Error fetching customer contact groups:", error);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error", groups: [] });
    }
  });

  app.get("/api/customer-operations", async (req, res) => {
    try {
      const customerId = (req.query.customerId as string) || "";
      const customerName = (req.query.customerName as string) || "";
      if (req.query.refresh === "true" || req.query._t) {
        invalidateAnalyticsCache();
      }
      const operations = await getCustomerOperations(customerId, customerName);
      return res.json({ success: true, ...operations });
    } catch (error) {
      console.error("Error fetching customer operations:", error);
      return res.status(500).json({
        success: false,
        error: "Internal server error",
        activities: [],
        products: [],
        deals: [],
        tasks: [],
        tickets: [],
        groups: [],
        notes: [],
      });
    }
  });

  app.get("/api/notes", async (req, res) => {
    try {
      const result = await getNotesHandler({
        httpMethod: "GET",
        path: "/notes",
        headers: req.headers as Record<string, string | undefined>,
        queryStringParameters: req.query as Record<string, string | undefined>,
      });

      let responseData: unknown;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }

      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error fetching notes:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Internal server error",
        notes: [],
      });
    }
  });

  app.post("/api/notes", async (req, res) => {
    try {
      const result = await createNoteHandler({
        httpMethod: "POST",
        path: "/notes",
        headers: req.headers as Record<string, string | undefined>,
        body: typeof req.body === "string" ? req.body : JSON.stringify(req.body),
      });

      let responseData: any;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }

      if (result.statusCode >= 200 && result.statusCode < 300) {
        invalidateAnalyticsCache();
      }

      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error creating note:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to create note",
      });
    }
  });

  app.delete("/api/notes/:id", async (req, res) => {
    try {
      const result = await deleteNoteHandler({
        httpMethod: "DELETE",
        path: `/notes/${req.params.id}`,
        pathParameters: { id: req.params.id },
        headers: req.headers as Record<string, string | undefined>,
      });

      let responseData: unknown;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }

      if (result.statusCode >= 200 && result.statusCode < 300) {
        invalidateAnalyticsCache();
      }

      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error deleting note:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Internal server error",
      });
    }
  });

  const handleUpdateNote = async (req: express.Request, res: express.Response) => {
    try {
      const result = await updateNoteHandler({
        httpMethod: req.method,
        path: `/notes/${req.params.id}`,
        pathParameters: { id: req.params.id },
        headers: req.headers as Record<string, string | undefined>,
        body: typeof req.body === "string" ? req.body : JSON.stringify(req.body),
      });

      let responseData: unknown;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }

      if (result.statusCode >= 200 && result.statusCode < 300) {
        invalidateAnalyticsCache();
      }

      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error updating note:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Internal server error",
      });
    }
  };

  app.put("/api/notes/:id", handleUpdateNote);
  app.patch("/api/notes/:id", handleUpdateNote);

  // Meetings endpoints
  app.get("/api/meetings", async (req, res) => {
    try {
      const result = await getMeetingsHandler({
        httpMethod: "GET",
        path: "/meetings",
        headers: req.headers as Record<string, string | undefined>,
        queryStringParameters: req.query as Record<string, string | undefined>,
      });
      let responseData: unknown;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error fetching meetings:", error);
      return res.status(500).json({ success: false, error: error?.message || "Internal server error", meetings: [] });
    }
  });

  app.post("/api/meetings", async (req, res) => {
    try {
      const result = await createMeetingHandler({
        httpMethod: "POST",
        path: "/meetings",
        headers: req.headers as Record<string, string | undefined>,
        body: typeof req.body === "string" ? req.body : JSON.stringify(req.body),
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error creating meeting:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to create meeting",
      });
    }
  });

  app.delete("/api/meetings/:id", async (req, res) => {
    try {
      const result = await deleteMeetingHandler({
        httpMethod: "DELETE",
        path: `/meetings/${req.params.id}`,
        pathParameters: { id: req.params.id },
        headers: req.headers as Record<string, string | undefined>,
      });
      let responseData: unknown;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error deleting meeting:", error);
      return res.status(500).json({ success: false, error: error?.message || "Internal server error" });
    }
  });

  const handleUpdateMeeting = async (req: express.Request, res: express.Response) => {
    try {
      const result = await updateMeetingHandler({
        httpMethod: req.method,
        path: `/meetings/${req.params.id}`,
        pathParameters: { id: req.params.id },
        headers: req.headers as Record<string, string | undefined>,
        body: typeof req.body === "string" ? req.body : JSON.stringify(req.body),
      });
      let responseData: unknown;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error updating meeting:", error);
      return res.status(500).json({ success: false, error: error?.message || "Internal server error" });
    }
  };

  app.put("/api/meetings/:id", handleUpdateMeeting);
  app.patch("/api/meetings/:id", handleUpdateMeeting);

  function normalizeInvoiceRecord(inv: any): any {
    if (!inv) return inv;
    const amt = Number(inv.amount) || 0;
    const tax = inv.tax !== undefined ? Number(inv.tax) : Math.round(amt * 0.18);
    const total = inv.total !== undefined ? Number(inv.total) : amt + tax;
    const num = inv.invoice_number || inv.invoiceNumber || inv.id || "";
    const custId = inv.customer_id || inv.customerId || "";
    const custName = inv.customer_name || inv.customer || inv.customerName || "Superblock Customer";
    const desc = inv.description || inv.product || "Growth + WhatsApp API";

    let dateStr = inv.date || "";
    const rawIssue = inv.issue_date || inv.issueDate || inv.date || inv.created_at;
    if (!dateStr && rawIssue) {
      try {
        dateStr = new Date(rawIssue).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
      } catch {
        dateStr = String(rawIssue);
      }
    }

    let dueStr = inv.dueDate || "";
    const rawDue = inv.due_date || inv.dueDate;
    if (!dueStr && rawDue) {
      try {
        dueStr = new Date(rawDue).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
      } catch {
        dueStr = String(rawDue);
      }
    }

    const status = inv.status || "Paid";
    const paidDate = inv.paymentDate || inv.paid_date || (status.toLowerCase() === "paid" ? dateStr : undefined);

    return {
      id: num || inv.id,
      invoice_number: num,
      invoiceNumber: num,
      customer: custName,
      customer_name: custName,
      customerId: custId,
      customer_id: custId,
      product: desc,
      description: desc,
      date: dateStr || "—",
      issue_date: rawIssue || new Date().toISOString().split("T")[0],
      dueDate: dueStr || "—",
      due_date: rawDue || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      amount: amt,
      tax,
      total,
      status,
      currency: inv.currency || "INR",
      paymentDate: paidDate,
      paid_date: paidDate,
      created_at: inv.created_at || new Date().toISOString(),
      updated_at: inv.updated_at || new Date().toISOString(),
    };
  }

  // Invoices endpoints (GET, POST, PUT, DELETE) connected to Supabase public.invoices
  app.get("/api/invoices", async (req, res) => {
    try {
      const customerId = (
        (req.query.customerId as string) ||
        (req.query.customer_id as string) ||
        ""
      ).trim();

      const result = await getInvoicesHandler({
        httpMethod: "GET",
        path: "/invoices",
        headers: req.headers as Record<string, string | undefined>,
        queryStringParameters: req.query as Record<string, string | undefined>,
      });

      let responseData: any;
      try {
        responseData = JSON.parse(result.body || "{}");
      } catch {
        responseData = { message: result.body };
      }

      if (result.statusCode >= 200 && result.statusCode < 300 && Array.isArray(responseData?.invoices)) {
        const normalized = responseData.invoices.map(normalizeInvoiceRecord);
        return res.status(200).json({
          success: true,
          count: normalized.length,
          customerId: customerId || undefined,
          invoices: normalized,
        });
      }

      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error in GET /api/invoices:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to fetch invoices",
        invoices: [],
      });
    }
  });

  app.put("/api/invoices/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const updates = req.body || {};
      const result = await updateInvoiceHandler({
        httpMethod: "PUT",
        path: `/invoices/${id}`,
        pathParameters: { id },
        headers: req.headers as Record<string, string | undefined>,
        body: JSON.stringify(updates),
      });

      let responseData: any;
      try {
        responseData = JSON.parse(result.body || "{}");
      } catch {
        responseData = { message: result.body };
      }

      if (result.statusCode >= 200 && result.statusCode < 300) {
        invalidateAnalyticsCache();
        if (responseData?.invoice) {
          responseData.invoice = normalizeInvoiceRecord(responseData.invoice);
        }
      }

      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error in PUT /api/invoices/:id:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to update invoice" });
    }
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const result = await deleteInvoiceHandler({
        httpMethod: "DELETE",
        path: `/invoices/${id}`,
        pathParameters: { id },
        headers: req.headers as Record<string, string | undefined>,
      });

      let responseData: any;
      try {
        responseData = JSON.parse(result.body || "{}");
      } catch {
        responseData = { message: result.body };
      }

      if (result.statusCode >= 200 && result.statusCode < 300) {
        invalidateAnalyticsCache();
      }

      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error in DELETE /api/invoices/:id:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to delete invoice" });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      const totalAmount = Number(body.amount) || 0;
      const invNumber = (
        body.invoiceNumber ||
        body.invoice_number ||
        body.id ||
        `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
      ).trim();
      const customerId = (body.customerId || body.customer_id || "CUS-DEFAULT").trim();
      const description = (body.product || body.description || "Platform & Software Services").trim();
      const status = (body.status || "Sent").trim();
      const issueDate = body.issueDate || body.issue_date || body.date;
      const dueDate = body.dueDate || body.due_date;
      const currency = (body.currency || "INR").trim();

      const result = await createInvoiceHandler({
        httpMethod: "POST",
        path: "/invoices",
        headers: req.headers as Record<string, string | undefined>,
        body: JSON.stringify({
          customerId,
          invoiceNumber: invNumber,
          amount: totalAmount,
          currency,
          status,
          issueDate,
          dueDate,
          paidDate: status.toLowerCase() === "paid" ? (body.paidDate || body.paid_date || issueDate) : (body.paidDate || body.paid_date || null),
          description,
        }),
      });

      let responseData: any;
      try {
        responseData = JSON.parse(result.body || "{}");
      } catch {
        responseData = { message: result.body };
      }

      if (result.statusCode >= 200 && result.statusCode < 300) {
        invalidateAnalyticsCache();
        if (responseData?.invoice) {
          responseData.invoice = normalizeInvoiceRecord(responseData.invoice);
        }
      }

      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error creating invoice:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to create invoice",
      });
    }
  });

  let fallbackSettings = {
    profile: {
      fullName: "Anika Shah",
      displayName: "Anika",
      email: "anika@superblock.chat",
      phone: "+91 98765 43210",
      timezone: "ist",
    },
    notifications: {
      renewalAlerts: true,
      billingExceptions: true,
      usageAnomalies: true,
      productUpdates: false,
    },
    security: {
      twoFactorEnabled: false,
      loginAlerts: true,
      sessionTimeoutHours: "8",
      activeSessions: [
        { id: "sess-1", device: "Chrome on macOS", location: "Mumbai, India", lastActive: "Active now", isCurrent: true },
        { id: "sess-2", device: "Safari on iPhone", location: "Mumbai, India", lastActive: "2 days ago", isCurrent: false },
      ],
    },
    apiKeys: [
      { id: "key-1", name: "Production Webhook", keyPrefix: "sb_live_92f...", createdAt: "01 Sep 2026", expiresAt: "01 Sep 2027" },
    ],
    workspaceName: "Superblock HQ",
  };

  const customerOverrides = new Map<string, any>();
  const subscriptionCustomerNames = new Map<string, string>();
  for (const [key, info] of Object.entries(customerContactsSummary)) {
    if (info.customerName) {
      subscriptionCustomerNames.set(key, info.customerName);
      if (info.customerId) subscriptionCustomerNames.set(info.customerId, info.customerName);
      if (info.clientUserId) subscriptionCustomerNames.set(info.clientUserId, info.customerName);
    }
  }

  // Subscriptions endpoints (GET, POST, PUT, DELETE) connected to Supabase public.subscriptions
  app.get("/api/subscriptions", async (req, res) => {
    try {
      const result = await getSubscriptionsHandler({
        httpMethod: "GET",
        path: "/subscriptions",
        headers: req.headers as Record<string, string | undefined>,
        queryStringParameters: req.query as Record<string, string | undefined>,
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      if (result.statusCode >= 200 && result.statusCode < 300 && responseData?.success && Array.isArray(responseData?.subscriptions)) {
        const enriched = responseData.subscriptions.map((s: any) => {
          const custName = s.customer_name || subscriptionCustomerNames.get(s.id) || subscriptionCustomerNames.get(s.customer_id) || s.customer || "Superblock Customer";
          return {
            ...s,
            customer: custName,
            customer_name: custName,
          };
        });
        return res.status(200).json({
          success: true,
          count: enriched.length,
          subscriptions: enriched,
        });
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error fetching subscriptions:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to fetch subscriptions", subscriptions: [] });
    }
  });

  app.post("/api/subscriptions", async (req, res) => {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const result = await createSubscriptionHandler({
        httpMethod: "POST",
        path: "/subscriptions",
        headers: req.headers as Record<string, string | undefined>,
        body: typeof req.body === "string" ? req.body : JSON.stringify(req.body),
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      if (result.statusCode >= 200 && result.statusCode < 300 && responseData?.success) {
        if (responseData.subscription?.id && body?.customer) {
          subscriptionCustomerNames.set(responseData.subscription.id, body.customer);
        }
        if (responseData.subscription?.customer_id && body?.customer && !customerContactsSummary[responseData.subscription.customer_id]) {
          subscriptionCustomerNames.set(responseData.subscription.customer_id, body.customer);
        }
        const custName = body?.customer || responseData.subscription?.customer_name || "Superblock Customer";
        const enriched = {
          ...responseData.subscription,
          customer: custName,
          customer_name: custName,
        };
        return res.status(result.statusCode).json({
          success: true,
          subscription: enriched,
        });
      }
      return res.status(result.statusCode || 400).json(responseData);
    } catch (error: any) {
      console.error("POST /api/subscriptions error:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to create subscription" });
    }
  });

  app.put("/api/subscriptions/:id", async (req, res) => {
    const id = req.params.id;
    try {
      const result = await updateSubscriptionHandler({
        httpMethod: "PUT",
        path: `/subscriptions/${id}`,
        pathParameters: { id },
        headers: req.headers as Record<string, string | undefined>,
        body: typeof req.body === "string" ? req.body : JSON.stringify(req.body),
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      if (result.statusCode >= 200 && result.statusCode < 300 && responseData?.success) {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        if (body?.customer && responseData.subscription?.id) {
          subscriptionCustomerNames.set(responseData.subscription.id, body.customer);
        }
        const custName = body?.customer || subscriptionCustomerNames.get(id) || (responseData.subscription?.customer_id ? subscriptionCustomerNames.get(responseData.subscription.customer_id) : null) || responseData.subscription?.customer_name || "Superblock Customer";
        const enriched = {
          ...responseData.subscription,
          customer: custName,
          customer_name: custName,
        };
        return res.status(200).json({
          success: true,
          subscription: enriched,
        });
      }
      return res.status(result.statusCode || 400).json(responseData);
    } catch (error: any) {
      console.error("PUT /api/subscriptions/:id error:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to update subscription" });
    }
  });

  app.delete("/api/subscriptions/:id", async (req, res) => {
    const id = req.params.id;
    subscriptionCustomerNames.delete(id);
    try {
      const result = await deleteSubscriptionHandler({
        httpMethod: "DELETE",
        path: `/subscriptions/${id}`,
        pathParameters: { id },
        headers: req.headers as Record<string, string | undefined>,
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("DELETE /api/subscriptions/:id error:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to delete subscription" });
    }
  });

  // Credentials endpoint
  app.get("/api/credentials", async (req, res) => {
    try {
      const result = await getCredentialsHandler({
        httpMethod: "GET",
        path: "/credentials",
        headers: req.headers as Record<string, string | undefined>,
        queryStringParameters: req.query as Record<string, string | undefined>,
      });
      let responseData: unknown;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error fetching credentials:", error);
      return res.status(500).json({ success: false, error: error?.message || "Internal server error", credentials: null });
    }
  });

  // Products endpoints (GET, POST, PUT, DELETE) connected to Supabase public.products
  app.get("/api/products", async (req, res) => {
    try {
      const result = await getProductsHandler({
        httpMethod: "GET",
        path: "/products",
        headers: req.headers as Record<string, string | undefined>,
        queryStringParameters: req.query as Record<string, string | undefined>,
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error fetching products:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to fetch products", products: [] });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const result = await createProductHandler({
        httpMethod: "POST",
        path: "/products",
        headers: req.headers as Record<string, string | undefined>,
        body: JSON.stringify({
          customerId: body.customerId || "superblock",
          id: body.id,
          name: body.name,
          category: body.category,
          billing: body.model || body.billing,
          description: body.description,
          price: body.price,
          active: body.status !== "Archived" && body.active !== false,
        }),
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error creating product:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to create product" });
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    const id = req.params.id;
    try {
      const result = await updateProductHandler({
        httpMethod: "PUT",
        path: `/products/${id}`,
        pathParameters: { id },
        headers: req.headers as Record<string, string | undefined>,
        body: typeof req.body === "string" ? req.body : JSON.stringify(req.body),
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error updating product:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    const id = req.params.id;
    try {
      const result = await deleteProductHandler({
        httpMethod: "DELETE",
        path: `/products/${id}`,
        pathParameters: { id },
        headers: req.headers as Record<string, string | undefined>,
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error deleting product:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to delete product" });
    }
  });

  // Plans endpoints (GET, POST, PUT, DELETE) connected to Supabase public.plans
  app.get("/api/plans", async (req, res) => {
    try {
      const result = await getPlansHandler({
        httpMethod: "GET",
        path: "/plans",
        headers: req.headers as Record<string, string | undefined>,
        queryStringParameters: req.query as Record<string, string | undefined>,
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error fetching plans:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to fetch plans", plans: [] });
    }
  });

  app.post("/api/plans", async (req, res) => {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      const result = await createPlanHandler({
        httpMethod: "POST",
        path: "/plans",
        headers: req.headers as Record<string, string | undefined>,
        body: JSON.stringify(body),
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body || "{}");
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error creating plan:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to create plan",
      });
    }
  });

  app.put("/api/plans/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const updates = req.body || {};
      const result = await updatePlanHandler({
        httpMethod: "PUT",
        path: `/plans/${id}`,
        pathParameters: { id },
        headers: req.headers as Record<string, string | undefined>,
        body: JSON.stringify(updates),
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body || "{}");
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error updating plan:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to update plan",
      });
    }
  });

  app.delete("/api/plans/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const result = await deletePlanHandler({
        httpMethod: "DELETE",
        path: `/plans/${id}`,
        pathParameters: { id },
        headers: req.headers as Record<string, string | undefined>,
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body || "{}");
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error deleting plan:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to delete plan",
      });
    }
  });

  // Team endpoints (GET, POST, PUT, DELETE) connected to Supabase public.team_members
  app.get("/api/team", async (req, res) => {
    try {
      const result = await getTeamMembersHandler({
        httpMethod: "GET",
        path: "/team-members",
        headers: req.headers as Record<string, string | undefined>,
        queryStringParameters: req.query as Record<string, string | undefined>,
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error fetching team members:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to fetch team members", teamMembers: [] });
    }
  });

  app.post("/api/team", async (req, res) => {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const result = await createTeamMemberHandler({
        httpMethod: "POST",
        path: "/team-members",
        headers: req.headers as Record<string, string | undefined>,
        body: JSON.stringify({
          customerId: body.customerId || "superblock",
          id: body.id,
          teamUserId: body.teamUserId || body.id,
          name: body.name,
          email: body.email,
          role: body.role,
          avatarUrl: body.avatarUrl || body.avatar_url,
        }),
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode || (responseData?.success ? 200 : 400)).json(responseData);
    } catch (error: any) {
      console.error("POST /api/team error:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Internal server error during team invitation",
      });
    }
  });

  app.put("/api/team/:id", async (req, res) => {
    const id = req.params.id;
    try {
      const result = await updateTeamMemberHandler({
        httpMethod: "PUT",
        path: `/team/${id}`,
        pathParameters: { id },
        headers: req.headers as Record<string, string | undefined>,
        body: typeof req.body === "string" ? req.body : JSON.stringify(req.body),
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("PUT /api/team/:id error:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to update team member" });
    }
  });

  const handleDeleteTeamMember = async (req: express.Request, res: express.Response) => {
    const id = req.params.id || (req.query.id as string) || (req.query.email as string) || req.body?.id || req.body?.email;
    try {
      const result = await deleteTeamMemberHandler({
        httpMethod: "DELETE",
        path: `/team/${id || ""}`,
        pathParameters: id ? { id } : undefined,
        queryStringParameters: req.query as Record<string, string | undefined>,
        headers: req.headers as Record<string, string | undefined>,
        body: typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}),
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode || (responseData?.success ? 200 : 400)).json(responseData);
    } catch (error: any) {
      console.error("DELETE /api/team error:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to delete team member" });
    }
  };

  app.delete("/api/team/:id", handleDeleteTeamMember);
  app.delete("/api/team", handleDeleteTeamMember);

  // Settings endpoints (GET, POST)
  app.get("/api/settings", (_req, res) => {
    return res.json({ success: true, settings: fallbackSettings });
  });

  app.post("/api/settings", (req, res) => {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    fallbackSettings = {
      ...fallbackSettings,
      ...body,
      profile: { ...fallbackSettings.profile, ...(body.profile || {}) },
      notifications: { ...fallbackSettings.notifications, ...(body.notifications || {}) },
      security: { ...fallbackSettings.security, ...(body.security || {}) },
    };
    return res.json({ success: true, settings: fallbackSettings });
  });

  // Customer Profile Update endpoint
  app.put("/api/customers/:id", (req, res) => {
    const id = req.params.id;
    const updates = req.body || {};
    customerOverrides.set(id, { ...(customerOverrides.get(id) || {}), ...updates, updatedAt: new Date().toISOString() });
    return res.json({ success: true, customerId: id, updates: customerOverrides.get(id) });
  });

  app.get("/api/customers/:id/overrides", (req, res) => {
    const id = req.params.id;
    return res.json({ success: true, customerId: id, overrides: customerOverrides.get(id) || null });
  });

  // Usage Metrics endpoint
  app.get("/api/usage-metrics", async (req, res) => {
    try {
      const result = await getUsageMetricsHandler({
        httpMethod: "GET",
        path: "/usage-metrics",
        headers: req.headers as Record<string, string | undefined>,
        queryStringParameters: req.query as Record<string, string | undefined>,
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error fetching usage metrics:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to fetch usage metrics",
        usageMetrics: [],
      });
    }
  });

  // Customer Offerings endpoints connected to Supabase public.customer_offerings
  app.get("/api/customer-offerings", async (req, res) => {
    try {
      const result = await getCustomerOfferingsHandler({
        httpMethod: "GET",
        path: "/customer-offerings",
        headers: req.headers as Record<string, string | undefined>,
        queryStringParameters: req.query as Record<string, string | undefined>,
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error fetching customer offerings:", error);
      return res.status(500).json({ success: false, error: error?.message || "Failed to fetch customer offerings", offerings: [] });
    }
  });

  app.post("/api/customer-offerings", async (req, res) => {
    try {
      const result = await createCustomerOfferingHandler({
        httpMethod: "POST",
        path: "/customer-offerings",
        headers: req.headers as Record<string, string | undefined>,
        body: typeof req.body === "string" ? req.body : JSON.stringify(req.body),
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error creating customer offering:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to create customer offering",
      });
    }
  });

  app.delete("/api/customer-offerings/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const result = await deleteCustomerOfferingHandler({
        httpMethod: "DELETE",
        path: `/customer-offerings/${id}`,
        pathParameters: { id },
        headers: req.headers as Record<string, string | undefined>,
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error deleting customer offering:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to delete customer offering",
      });
    }
  });

export async function startServer() {
  const server = createServer(app);

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

const isMain = process.argv[1] && (
  process.argv[1].endsWith("server/index.ts") ||
  process.argv[1].endsWith("server\\index.ts") ||
  process.argv[1].endsWith("dist/index.js") ||
  process.argv[1].endsWith("dist\\index.js")
);
const isVite = process.argv.some((arg) => arg.includes("vite"));
if (isMain && !isVite) {
  startServer().catch(console.error);
}
