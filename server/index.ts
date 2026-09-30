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
import { customerContactsSummary } from "../client/src/data/customerContactsData";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// Parse JSON payloads
app.use(express.json());

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

      if (
        result.statusCode >= 500 ||
        (responseData && !responseData.success && (responseData.error?.includes("ECONNRESET") || responseData.error?.includes("connect")))
      ) {
        const bodyObj = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
        return res.status(200).json({
          success: true,
          offline: true,
          note: {
            id: `note-${Date.now()}`,
            customer_id: bodyObj.customerId || bodyObj.customer_id,
            title: bodyObj.title || "Customer Note",
            content: bodyObj.content || "",
            created_by: bodyObj.createdBy || "Admin User",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        });
      }

      if (result.statusCode >= 200 && result.statusCode < 300) {
        invalidateAnalyticsCache();
      }

      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error creating note:", error);
      const bodyObj = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      return res.status(200).json({
        success: true,
        offline: true,
        note: {
          id: `note-${Date.now()}`,
          customer_id: bodyObj.customerId || bodyObj.customer_id,
          title: bodyObj.title || "Customer Note",
          content: bodyObj.content || "",
          created_by: bodyObj.createdBy || "Admin User",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
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
      if (
        result.statusCode >= 500 ||
        (responseData && !responseData.success && (responseData.error?.includes("ECONNRESET") || responseData.error?.includes("connect")))
      ) {
        const bodyObj = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
        return res.status(200).json({
          success: true,
          offline: true,
          meeting: {
            id: `meeting-${Date.now()}`,
            customer_id: bodyObj.customerId || bodyObj.customer_id,
            title: bodyObj.title || "Meeting",
            description: bodyObj.description || null,
            meeting_date: bodyObj.meetingDate || new Date().toISOString(),
            duration_minutes: bodyObj.durationMinutes ?? 30,
            status: bodyObj.status || "scheduled",
            meeting_url: bodyObj.meetingUrl || null,
            created_by: bodyObj.createdBy || "Admin User",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        });
      }
      return res.status(result.statusCode).json(responseData);
    } catch (error: any) {
      console.error("Error creating meeting:", error);
      const bodyObj = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      return res.status(200).json({
        success: true,
        offline: true,
        meeting: {
          id: `meeting-${Date.now()}`,
          customer_id: bodyObj.customerId || bodyObj.customer_id,
          title: bodyObj.title || "Meeting",
          description: bodyObj.description || null,
          meeting_date: bodyObj.meetingDate || new Date().toISOString(),
          duration_minutes: bodyObj.durationMinutes ?? 30,
          status: bodyObj.status || "scheduled",
          meeting_url: bodyObj.meetingUrl || null,
          created_by: bodyObj.createdBy || "Admin User",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
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

  const INVOICES_STORAGE_FILE = path.join(__dirname, "invoices-data.json");

  function getInitialInvoices() {
    return [
      {
        id: "INV-20341",
        invoice_number: "INV-20341",
        invoiceNumber: "INV-20341",
        date: "01 Sep 2026",
        issue_date: "2026-09-01",
        dueDate: "10 Sep 2026",
        due_date: "2026-09-10",
        product: "Growth + WhatsApp API",
        description: "Growth + WhatsApp API",
        amount: 128000,
        tax: 23040,
        total: 151040,
        status: "Paid",
        paymentDate: "06 Sep 2026",
        paid_date: "2026-09-06",
        customer: "Acme Commerce",
        customer_name: "Acme Commerce",
        customerId: "CUS-10482",
        customer_id: "CUS-10482",
        currency: "INR",
        created_at: "2026-09-01T00:00:00.000Z",
        updated_at: "2026-09-01T00:00:00.000Z",
      },
      {
        id: "INV-20116",
        invoice_number: "INV-20116",
        invoiceNumber: "INV-20116",
        date: "01 Aug 2026",
        issue_date: "2026-08-01",
        dueDate: "10 Aug 2026",
        due_date: "2026-08-10",
        product: "Growth + WhatsApp API",
        description: "Growth + WhatsApp API",
        amount: 128000,
        tax: 23040,
        total: 151040,
        status: "Paid",
        paymentDate: "08 Aug 2026",
        paid_date: "2026-08-08",
        customer: "Acme Commerce",
        customer_name: "Acme Commerce",
        customerId: "CUS-10482",
        customer_id: "CUS-10482",
        currency: "INR",
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
      },
      {
        id: "INV-19982",
        invoice_number: "INV-19982",
        invoiceNumber: "INV-19982",
        date: "01 Jul 2026",
        issue_date: "2026-07-01",
        dueDate: "10 Jul 2026",
        due_date: "2026-07-10",
        product: "Growth + WhatsApp API",
        description: "Growth + WhatsApp API",
        amount: 124000,
        tax: 22320,
        total: 146320,
        status: "Paid",
        paymentDate: "09 Jul 2026",
        paid_date: "2026-07-09",
        customer: "Acme Commerce",
        customer_name: "Acme Commerce",
        customerId: "CUS-10482",
        customer_id: "CUS-10482",
        currency: "INR",
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "INV-20455",
        invoice_number: "INV-20455",
        invoiceNumber: "INV-20455",
        date: "15 Sep 2026",
        issue_date: "2026-09-15",
        dueDate: "25 Sep 2026",
        due_date: "2026-09-25",
        product: "Advanced + AI Agent",
        description: "Advanced + AI Agent",
        amount: 186000,
        tax: 33480,
        total: 219480,
        status: "Sent",
        customer: "Northstar Learning",
        customer_name: "Northstar Learning",
        customerId: "CUS-10461",
        customer_id: "CUS-10461",
        currency: "INR",
        created_at: "2026-09-15T00:00:00.000Z",
        updated_at: "2026-09-15T00:00:00.000Z",
      },
      {
        id: "INV-20412",
        invoice_number: "INV-20412",
        invoiceNumber: "INV-20412",
        date: "10 Sep 2026",
        issue_date: "2026-09-10",
        dueDate: "20 Sep 2026",
        due_date: "2026-09-20",
        product: "Growth",
        description: "Growth",
        amount: 92000,
        tax: 16560,
        total: 108560,
        status: "Paid",
        paymentDate: "12 Sep 2026",
        paid_date: "2026-09-12",
        customer: "Carely Health",
        customer_name: "Carely Health",
        customerId: "CUS-10444",
        customer_id: "CUS-10444",
        currency: "INR",
        created_at: "2026-09-10T00:00:00.000Z",
        updated_at: "2026-09-10T00:00:00.000Z",
      },
      {
        id: "INV-20389",
        invoice_number: "INV-20389",
        invoiceNumber: "INV-20389",
        date: "05 Sep 2026",
        issue_date: "2026-09-05",
        dueDate: "15 Sep 2026",
        due_date: "2026-09-15",
        product: "Advanced",
        description: "Advanced",
        amount: 214000,
        tax: 38520,
        total: 252520,
        status: "Overdue",
        customer: "Fleetgrid Logistics",
        customer_name: "Fleetgrid Logistics",
        customerId: "CUS-10398",
        customer_id: "CUS-10398",
        currency: "INR",
        created_at: "2026-09-05T00:00:00.000Z",
        updated_at: "2026-09-05T00:00:00.000Z",
      },
      {
        id: "INV-20299",
        invoice_number: "INV-20299",
        invoiceNumber: "INV-20299",
        date: "20 Aug 2026",
        issue_date: "2026-08-20",
        dueDate: "30 Aug 2026",
        due_date: "2026-08-30",
        product: "Enterprise",
        description: "Enterprise",
        amount: 248000,
        tax: 44640,
        total: 292640,
        status: "Draft",
        customer: "Mirovia Finance",
        customer_name: "Mirovia Finance",
        customerId: "CUS-10376",
        customer_id: "CUS-10376",
        currency: "INR",
        created_at: "2026-08-20T00:00:00.000Z",
        updated_at: "2026-08-20T00:00:00.000Z",
      },
    ];
  }

  function loadFallbackInvoices(): any[] {
    try {
      if (fs.existsSync(INVOICES_STORAGE_FILE)) {
        const raw = fs.readFileSync(INVOICES_STORAGE_FILE, "utf-8");
        const data = JSON.parse(raw);
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch (err) {
      console.warn("Could not read invoices-data.json:", err);
    }
    const initial = getInitialInvoices();
    try {
      fs.writeFileSync(INVOICES_STORAGE_FILE, JSON.stringify(initial, null, 2), "utf-8");
    } catch {}
    return initial;
  }

  function saveFallbackInvoicesToDisk(invoices: any[]) {
    try {
      fs.writeFileSync(INVOICES_STORAGE_FILE, JSON.stringify(invoices, null, 2), "utf-8");
    } catch (err) {
      console.warn("Could not write invoices-data.json:", err);
    }
  }

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
    const paidDate = inv.paymentDate || inv.paid_date || (status === "Paid" ? dateStr : undefined);

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
      issue_date: rawIssue || new Date().toISOString(),
      dueDate: dueStr || "—",
      due_date: rawDue || new Date(Date.now() + 14 * 86400000).toISOString(),
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

  // Invoices endpoints
  app.get("/api/invoices", async (req, res) => {
    try {
      const customerId = (
        (req.query.customerId as string) ||
        (req.query.customer_id as string) ||
        ""
      ).trim();

      let dbInvoices: any[] | null = null;
      try {
        const result = await getInvoicesHandler({
          httpMethod: "GET",
          path: "/invoices",
          headers: req.headers as Record<string, string | undefined>,
          queryStringParameters: req.query as Record<string, string | undefined>,
        });
        if (result.statusCode >= 200 && result.statusCode < 300) {
          const parsed = JSON.parse(result.body || "{}");
          if (parsed?.success && Array.isArray(parsed?.invoices)) {
            dbInvoices = parsed.invoices;
          }
        }
      } catch (err) {
        console.warn("Database getInvoices error, falling back:", err);
      }

      // Successful database path (getInvoicesHandler already filtered in SQL if customerId was provided)
      if (dbInvoices !== null) {
        const normalizedDb = dbInvoices.map(normalizeInvoiceRecord);
        return res.status(200).json({
          success: true,
          count: normalizedDb.length,
          customerId: customerId || undefined,
          invoices: normalizedDb,
          offline: false,
        });
      }

      // Safe fallback when DB is offline or unreachable
      const diskInvoices = loadFallbackInvoices().map(normalizeInvoiceRecord);
      const filtered = customerId
        ? diskInvoices.filter((inv) => {
            const cId = String(inv.customerId || inv.customer_id || "").toLowerCase();
            const targetId = customerId.toLowerCase();
            const cName = String(inv.customer || inv.customer_name || "").toLowerCase();
            return (
              cId === targetId ||
              cName === targetId ||
              cId.includes(targetId) ||
              targetId.includes(cId)
            );
          })
        : diskInvoices;

      return res.status(200).json({
        success: true,
        count: filtered.length,
        customerId: customerId || undefined,
        invoices: filtered,
        offline: true,
      });
    } catch (error: any) {
      console.warn("Error in GET /api/invoices:", error?.message);
      const fallback = loadFallbackInvoices().map(normalizeInvoiceRecord);
      return res.status(200).json({
        success: true,
        count: fallback.length,
        invoices: fallback,
        offline: true,
      });
    }
  });

  app.put("/api/invoices/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const updates = req.body || {};
      let dbUpdated: any = null;

      try {
        const result = await updateInvoiceHandler({
          httpMethod: "PUT",
          path: `/invoices/${id}`,
          pathParameters: { id },
          headers: req.headers as Record<string, string | undefined>,
          body: JSON.stringify(updates),
        });
        if (result.statusCode >= 200 && result.statusCode < 300) {
          const parsed = JSON.parse(result.body || "{}");
          if (parsed?.success && parsed?.invoice) {
            dbUpdated = parsed.invoice;
          }
        }
      } catch (dbErr) {
        console.warn("DB update failed, using fallback:", dbErr);
      }

      const current = loadFallbackInvoices();
      let updatedObj: any = null;

      const updatedList = current.map((inv) => {
        if (inv.id === id || inv.invoice_number === id) {
          updatedObj = normalizeInvoiceRecord(dbUpdated ? { ...inv, ...dbUpdated } : { ...inv, ...updates });
          return updatedObj;
        }
        return inv;
      });

      if (!updatedObj) {
        updatedObj = normalizeInvoiceRecord(dbUpdated || { id, ...updates });
        updatedList.unshift(updatedObj);
      }

      saveFallbackInvoicesToDisk(updatedList);
      invalidateAnalyticsCache();
      return res.json({ success: true, invoice: updatedObj, offline: !dbUpdated });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error?.message || "Failed to update invoice" });
    }
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      const id = req.params.id;
      let dbDeleted = false;

      try {
        const result = await deleteInvoiceHandler({
          httpMethod: "DELETE",
          path: `/invoices/${id}`,
          pathParameters: { id },
          headers: req.headers as Record<string, string | undefined>,
        });
        if (result.statusCode >= 200 && result.statusCode < 300) {
          dbDeleted = true;
        }
      } catch (dbErr) {
        console.warn("DB delete failed, using fallback:", dbErr);
      }

      const current = loadFallbackInvoices();
      const filtered = current.filter((i) => i.id !== id && i.invoice_number !== id);
      saveFallbackInvoicesToDisk(filtered);
      invalidateAnalyticsCache();
      return res.json({ success: true, id, offline: !dbDeleted });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error?.message || "Failed to delete invoice" });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

      const totalAmount = Number(body.amount) || 0;
      const tax = body.tax !== undefined ? Number(body.tax) : Math.round(totalAmount * 0.18);
      const total = body.total !== undefined ? Number(body.total) : totalAmount + tax;
      const invNumber = (
        body.invoiceNumber ||
        body.invoice_number ||
        body.id ||
        `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
      ).trim();
      const customerId = (body.customerId || body.customer_id || "CUS-DEFAULT").trim();
      const customerName = (body.customer || body.customerName || body.customer_name || "Superblock Customer").trim();
      const description = (body.product || body.description || "Platform & Software Services").trim();
      const status = (body.status || "Sent").trim();
      const issueDate = body.issueDate || body.issue_date || body.date || new Date().toISOString().split("T")[0];
      const dueDate = body.dueDate || body.due_date || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
      const currency = (body.currency || "INR").trim();

      const newInv = normalizeInvoiceRecord({
        id: invNumber,
        invoice_number: invNumber,
        invoiceNumber: invNumber,
        customerId,
        customer_id: customerId,
        customer: customerName,
        customer_name: customerName,
        product: description,
        description,
        date: typeof issueDate === "string" && issueDate.includes("-") && issueDate.length <= 10
          ? new Date(issueDate).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })
          : issueDate,
        issue_date: issueDate,
        dueDate: typeof dueDate === "string" && dueDate.includes("-") && dueDate.length <= 10
          ? new Date(dueDate).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })
          : dueDate,
        due_date: dueDate,
        amount: totalAmount,
        tax,
        total,
        status,
        currency,
        paymentDate: status === "Paid" ? new Date().toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }) : undefined,
        paid_date: status === "Paid" ? new Date().toISOString() : null,
      });

      // Attempt DB insert if reachable
      let dbInserted: any = null;
      try {
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
            paidDate: status === "Paid" ? (newInv.paid_date || new Date().toISOString().split("T")[0]) : (body.paidDate || body.paid_date || null),
            description,
          }),
        });
        if (result.statusCode >= 200 && result.statusCode < 300) {
          const parsed = JSON.parse(result.body || "{}");
          if (parsed?.success && parsed?.invoice) {
            dbInserted = parsed.invoice;
          }
        }
      } catch {
        // Fall back gracefully to disk store when DB is offline
      }

      const finalInv = dbInserted ? normalizeInvoiceRecord({ ...newInv, ...dbInserted }) : newInv;

      // Save to persistent disk store
      const current = loadFallbackInvoices();
      const updatedList = [finalInv, ...current.filter((i) => i.id !== finalInv.id && i.invoice_number !== finalInv.id)];
      saveFallbackInvoicesToDisk(updatedList);
      invalidateAnalyticsCache();

      return res.status(200).json({
        success: true,
        invoice: finalInv,
        invoices: updatedList,
        offline: !dbInserted,
      });
    } catch (error: any) {
      console.error("Error creating invoice:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to create invoice",
      });
    }
  });

  // In-memory fallback stores for graceful offline resilience during DB maintenance
  let fallbackProducts = [
    { id: "prod-1", name: "WhatsApp Business API", category: "Channel", model: "Usage based", status: "Active", plans: 3, customers: 942, description: "Managed WABA onboarding, messaging, and template operations." },
    { id: "prod-2", name: "Superblock Team Inbox", category: "Collaboration", model: "Per seat", status: "Active", plans: 4, customers: 788, description: "Centralized multi-agent inbox for WhatsApp, SMS, and Email." },
    { id: "prod-3", name: "Broadcast Studio", category: "Marketing", model: "Tiered usage", status: "Active", plans: 3, customers: 654, description: "Bulk messaging campaigns with advanced targeting." },
    { id: "prod-4", name: "AI Agent", category: "AI & Automation", model: "Outcome + usage", status: "Beta", plans: 2, customers: 86, description: "Automated generative bot for support and qualification." },
  ];

  let fallbackPlans = [
    { id: "plan-1", name: "Starter", product: "Omnichannel Suite", monthly: 1499, annual: 15290, limit: "10k broadcasts", features: 6, status: "Active" },
    { id: "plan-2", name: "Growth", product: "Omnichannel Suite", monthly: 2699, annual: 27530, limit: "Unlimited broadcasts", features: 12, status: "Active" },
    { id: "plan-3", name: "Advanced", product: "Omnichannel Suite", monthly: 5999, annual: 61190, limit: "5k automations", features: 18, status: "Active" },
    { id: "plan-4", name: "Enterprise", product: "Custom bundle", monthly: 0, annual: 0, limit: "Contracted", features: 24, status: "Private" },
  ];

  let fallbackSubscriptions = [
    { id: "sub-1", customer: "Acme Commerce", customerId: "CUS-10482", plan: "Growth", status: "Active", startDate: "12 Mar 2025", renewalDate: "11 Mar 2026", cycle: "Annual", mrr: 128000, amount: 1536000, payment: "Paid", autoRenewal: true },
    { id: "sub-2", customer: "Northstar Learning", customerId: "CUS-10461", plan: "Advanced", status: "Renewal Due", startDate: "19 Sep 2025", renewalDate: "18 Sep 2026", cycle: "Annual", mrr: 186000, amount: 2232000, payment: "Pending", autoRenewal: false },
    { id: "sub-3", customer: "Carely Health", customerId: "CUS-10444", plan: "Growth", status: "Active", startDate: "04 May 2025", renewalDate: "03 May 2026", cycle: "Monthly", mrr: 92000, amount: 1104000, payment: "Paid", autoRenewal: true },
    { id: "sub-4", customer: "Fleetgrid Logistics", customerId: "CUS-10398", plan: "Advanced", status: "Active", startDate: "14 Jul 2025", renewalDate: "13 Jul 2026", cycle: "Annual", mrr: 214000, amount: 2568000, payment: "Paid", autoRenewal: true },
    { id: "sub-5", customer: "Mirovia Finance", customerId: "CUS-10376", plan: "Enterprise", status: "Past due", startDate: "10 Feb 2025", renewalDate: "09 Feb 2026", cycle: "Annual", mrr: 248000, amount: 2976000, payment: "Past Due", autoRenewal: false },
  ];

  let fallbackTeamMembers = [
    { id: "tm-1", name: "Anika Shah", initials: "AS", email: "anika@superblock.chat", role: "Customer Success", department: "Customer", customers: 42, status: "Active", lastActive: "Now" },
    { id: "tm-2", name: "Karan Mehta", initials: "KM", email: "karan@superblock.chat", role: "Sales", department: "Revenue", customers: 31, status: "Active", lastActive: "8 min ago" },
    { id: "tm-3", name: "Rishi Kapoor", initials: "RK", email: "rishi@superblock.chat", role: "Support", department: "Customer", customers: 28, status: "Active", lastActive: "24 min ago" },
    { id: "tm-4", name: "Nisha Rao", initials: "NR", email: "nisha@superblock.chat", role: "Finance", department: "Finance", customers: 0, status: "Active", lastActive: "1 hr ago" },
    { id: "tm-5", name: "Dev Malhotra", initials: "DM", email: "dev@superblock.chat", role: "Analyst", department: "Operations", customers: 0, status: "Away", lastActive: "Yesterday" },
  ];

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
          offline: false,
        });
      }
      return res.status(200).json({ success: true, count: fallbackSubscriptions.length, subscriptions: fallbackSubscriptions, offline: true });
    } catch (error: any) {
      console.warn("Error fetching subscriptions (DB offline), serving fallback:", error?.message);
      return res.status(200).json({ success: true, count: fallbackSubscriptions.length, subscriptions: fallbackSubscriptions, offline: true });
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
          offline: false,
          subscription: enriched,
        });
      }
      // Offline fallback
      const newSub = {
        id: body.id || `sub-${Date.now()}`,
        customer: body.customer || "Superblock Customer",
        customerId: body.customerId || "CUS-DEFAULT",
        plan: body.plan || "Growth",
        status: body.status || "Active",
        startDate: body.startDate || new Date().toISOString().split("T")[0],
        renewalDate: body.renewalDate || body.endDate || new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
        cycle: body.cycle || body.billingInterval || "Annual",
        mrr: Number(body.amount) || Number(body.mrr) || 2500,
        amount: (Number(body.amount) || Number(body.mrr) || 2500) * 12,
        payment: "Paid",
        autoRenewal: body.autoRenewal ?? true,
      };
      fallbackSubscriptions = [newSub, ...fallbackSubscriptions.filter((s) => s.id !== newSub.id)];
      return res.status(200).json({ success: true, offline: true, subscription: newSub });
    } catch (error: any) {
      console.warn("POST /api/subscriptions failed, storing in fallback:", error?.message);
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const newSub = {
        id: body.id || `sub-${Date.now()}`,
        customer: body.customer || "Superblock Customer",
        customerId: body.customerId || "CUS-DEFAULT",
        plan: body.plan || "Growth",
        status: body.status || "Active",
        startDate: body.startDate || new Date().toISOString().split("T")[0],
        renewalDate: body.renewalDate || body.endDate || new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
        cycle: body.cycle || body.billingInterval || "Annual",
        mrr: Number(body.amount) || Number(body.mrr) || 2500,
        amount: (Number(body.amount) || Number(body.mrr) || 2500) * 12,
        payment: "Paid",
        autoRenewal: body.autoRenewal ?? true,
      };
      fallbackSubscriptions = [newSub, ...fallbackSubscriptions.filter((s) => s.id !== newSub.id)];
      return res.status(200).json({ success: true, offline: true, subscription: newSub });
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
          offline: false,
          subscription: enriched,
        });
      }
    } catch (error: any) {
      console.warn("PUT /api/subscriptions/:id DB error, falling back:", error?.message);
    }

    const updates = req.body || {};
    const existing = fallbackSubscriptions.find((s) => s.id === id);
    if (existing) {
      Object.assign(existing, updates);
    }
    return res.json({ success: true, offline: true, subscription: existing || updates });
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
      if (result.statusCode >= 200 && result.statusCode < 300 && responseData?.success) {
        return res.status(200).json({
          success: true,
          offline: false,
          id: responseData.id || id,
        });
      }
    } catch (error: any) {
      console.warn("DELETE /api/subscriptions/:id DB error, falling back:", error?.message);
    }

    fallbackSubscriptions = fallbackSubscriptions.filter((s) => s.id !== id);
    return res.json({ success: true, offline: true, id });
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
      if (result.statusCode >= 200 && result.statusCode < 300 && responseData?.success && Array.isArray(responseData?.products)) {
        return res.status(200).json({
          success: true,
          count: responseData.products.length,
          products: responseData.products,
          offline: false,
        });
      }
      return res.status(200).json({ success: true, count: fallbackProducts.length, products: fallbackProducts, offline: true });
    } catch (error: any) {
      console.warn("Error fetching products (DB offline), serving fallback:", error?.message);
      return res.status(200).json({ success: true, count: fallbackProducts.length, products: fallbackProducts, offline: true });
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
      if (result.statusCode >= 200 && result.statusCode < 300 && responseData?.success) {
        return res.status(result.statusCode).json({
          success: true,
          offline: false,
          product: responseData.product,
        });
      }
      // Offline fallback
      const newProduct = {
        id: body.id || `prod-${Date.now()}`,
        name: body.name || "New Product",
        category: body.category || "General",
        model: body.model || body.billing || "Usage based",
        status: body.status || "Active",
        plans: body.plans ?? 1,
        customers: body.customers ?? 0,
        description: body.description || `${body.category || "General"} capabilities.`,
      };
      fallbackProducts = [newProduct, ...fallbackProducts.filter((p) => p.id !== newProduct.id)];
      return res.status(200).json({ success: true, offline: true, product: newProduct });
    } catch (error: any) {
      console.warn("POST /api/products failed, storing in fallback:", error?.message);
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const newProduct = {
        id: body.id || `prod-${Date.now()}`,
        name: body.name || "New Product",
        category: body.category || "General",
        model: body.model || body.billing || "Usage based",
        status: body.status || "Active",
        plans: body.plans ?? 1,
        customers: body.customers ?? 0,
        description: body.description || `${body.category || "General"} capabilities.`,
      };
      fallbackProducts = [newProduct, ...fallbackProducts.filter((p) => p.id !== newProduct.id)];
      return res.status(200).json({ success: true, offline: true, product: newProduct });
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
      if (result.statusCode >= 200 && result.statusCode < 300 && responseData?.success) {
        return res.status(200).json({
          success: true,
          offline: false,
          product: responseData.product,
        });
      }
    } catch (error: any) {
      console.warn("PUT /api/products/:id DB error, falling back:", error?.message);
    }

    const updates = req.body || {};
    const existing = fallbackProducts.find((p) => p.id === id);
    if (existing) {
      Object.assign(existing, updates);
    }
    return res.json({ success: true, offline: true, product: existing || updates });
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
      if (result.statusCode >= 200 && result.statusCode < 300 && responseData?.success) {
        return res.status(200).json({
          success: true,
          offline: false,
          id: responseData.id || id,
        });
      }
    } catch (error: any) {
      console.warn("DELETE /api/products/:id DB error, falling back:", error?.message);
    }

    fallbackProducts = fallbackProducts.filter((p) => p.id !== id);
    return res.json({ success: true, offline: true, id });
  });

  // Plans endpoints (GET, POST, PUT, DELETE) connected to Supabase public.plans
  app.get("/api/plans", async (req, res) => {
    try {
      let dbPlans: any[] | null = null;
      try {
        const result = await getPlansHandler({
          httpMethod: "GET",
          path: "/plans",
          headers: req.headers as Record<string, string | undefined>,
          queryStringParameters: req.query as Record<string, string | undefined>,
        });
        if (result.statusCode >= 200 && result.statusCode < 300) {
          const parsed = JSON.parse(result.body || "{}");
          if (parsed?.success && Array.isArray(parsed?.plans)) {
            dbPlans = parsed.plans;
          }
        }
      } catch (err) {
        console.warn("Database getPlans error, falling back to in-memory:", err);
      }

      // Successful database path
      if (dbPlans !== null) {
        return res.status(200).json({
          success: true,
          count: dbPlans.length,
          plans: dbPlans,
          offline: false,
        });
      }

      // Safe offline fallback
      return res.status(200).json({
        success: true,
        count: fallbackPlans.length,
        plans: fallbackPlans,
        offline: true,
      });
    } catch (error: any) {
      return res.status(200).json({
        success: true,
        count: fallbackPlans.length,
        plans: fallbackPlans,
        offline: true,
      });
    }
  });

  app.post("/api/plans", async (req, res) => {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      let dbInserted: any = null;

      try {
        const result = await createPlanHandler({
          httpMethod: "POST",
          path: "/plans",
          headers: req.headers as Record<string, string | undefined>,
          body: JSON.stringify(body),
        });
        if (result.statusCode >= 200 && result.statusCode < 300) {
          const parsed = JSON.parse(result.body || "{}");
          if (parsed?.success && parsed?.plan) {
            dbInserted = parsed.plan;
          }
        }
      } catch (err) {
        console.warn("Database createPlan error, falling back to in-memory:", err);
      }

      const planRecord = dbInserted || {
        id: body.id || `plan-${Date.now()}`,
        name: body.name || "New Plan",
        product: body.product || "Omnichannel Suite",
        monthly: typeof body.monthly === "number" ? body.monthly : (Number(body.monthly) || 0),
        annual: typeof body.annual === "number" ? body.annual : (Number(body.annual) || ((Number(body.monthly) || 0) * 10)),
        limit: body.limit || "Standard limits",
        features: typeof body.features === "number" ? body.features : (Number(body.features) || 8),
        status: body.status || "Active",
        description: body.description || "",
      };

      // Keep offline fallback in sync
      fallbackPlans = [planRecord, ...fallbackPlans.filter((p) => p.id !== planRecord.id)];

      return res.status(200).json({
        success: true,
        plan: planRecord,
        offline: !dbInserted,
      });
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
      let dbUpdated: any = null;

      try {
        const result = await updatePlanHandler({
          httpMethod: "PUT",
          path: `/plans/${id}`,
          pathParameters: { id },
          headers: req.headers as Record<string, string | undefined>,
          body: JSON.stringify(updates),
        });
        if (result.statusCode >= 200 && result.statusCode < 300) {
          const parsed = JSON.parse(result.body || "{}");
          if (parsed?.success && parsed?.plan) {
            dbUpdated = parsed.plan;
          }
        }
      } catch (err) {
        console.warn("Database updatePlan error, falling back to in-memory:", err);
      }

      // Keep offline fallback in sync
      const existing = fallbackPlans.find((p) => p.id === id);
      if (existing) {
        Object.assign(existing, dbUpdated || updates);
      } else if (dbUpdated) {
        fallbackPlans.unshift(dbUpdated);
      }

      return res.json({
        success: true,
        plan: dbUpdated || existing || { id, ...updates },
        offline: !dbUpdated,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to update plan",
      });
    }
  });

  app.delete("/api/plans/:id", async (req, res) => {
    try {
      const id = req.params.id;
      let dbDeleted = false;

      try {
        const result = await deletePlanHandler({
          httpMethod: "DELETE",
          path: `/plans/${id}`,
          pathParameters: { id },
          headers: req.headers as Record<string, string | undefined>,
        });
        if (result.statusCode >= 200 && result.statusCode < 300) {
          dbDeleted = true;
        }
      } catch (err) {
        console.warn("Database deletePlan error, falling back to in-memory:", err);
      }

      // Keep offline fallback in sync
      fallbackPlans = fallbackPlans.filter((p) => p.id !== id);

      return res.json({
        success: true,
        id,
        offline: !dbDeleted,
      });
    } catch (error: any) {
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
      if (result.statusCode >= 200 && result.statusCode < 300 && responseData?.success && Array.isArray(responseData?.teamMembers)) {
        return res.status(200).json({
          success: true,
          count: responseData.teamMembers.length,
          teamMembers: responseData.teamMembers,
          offline: false,
        });
      }
      return res.status(200).json({ success: true, count: fallbackTeamMembers.length, teamMembers: fallbackTeamMembers, offline: true });
    } catch (error: any) {
      console.warn("Error fetching team (DB offline), serving fallback:", error?.message);
      return res.status(200).json({ success: true, count: fallbackTeamMembers.length, teamMembers: fallbackTeamMembers, offline: true });
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
      if (result.statusCode >= 200 && result.statusCode < 300 && responseData?.success) {
        return res.status(result.statusCode).json({
          success: true,
          offline: false,
          teamMember: responseData.teamMember,
        });
      }
      // Offline fallback
      const initials = (body.name || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
      const newMember = {
        id: body.id || `tm-${Date.now()}`,
        name: body.name || "New Member",
        initials: body.initials || initials,
        email: body.email || "member@superblock.chat",
        role: body.role || "Customer Success",
        department: body.department || "Customer",
        customers: body.customers ?? 0,
        status: body.status || "Active",
        lastActive: "Just now",
      };
      fallbackTeamMembers = [newMember, ...fallbackTeamMembers.filter((m) => m.id !== newMember.id && m.email !== newMember.email)];
      return res.status(200).json({ success: true, offline: true, teamMember: newMember });
    } catch (error: any) {
      console.warn("POST /api/team failed, storing in fallback:", error?.message);
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const initials = (body.name || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
      const newMember = {
        id: body.id || `tm-${Date.now()}`,
        name: body.name || "New Member",
        initials: body.initials || initials,
        email: body.email || "member@superblock.chat",
        role: body.role || "Customer Success",
        department: body.department || "Customer",
        customers: body.customers ?? 0,
        status: body.status || "Active",
        lastActive: "Just now",
      };
      fallbackTeamMembers = [newMember, ...fallbackTeamMembers.filter((m) => m.id !== newMember.id && m.email !== newMember.email)];
      return res.status(200).json({ success: true, offline: true, teamMember: newMember });
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
      if (result.statusCode >= 200 && result.statusCode < 300 && responseData?.success) {
        return res.status(200).json({
          success: true,
          offline: false,
          teamMember: responseData.teamMember,
        });
      }
    } catch (error: any) {
      console.warn("PUT /api/team/:id DB error, falling back:", error?.message);
    }

    const updates = req.body || {};
    const existing = fallbackTeamMembers.find((m) => m.id === id || m.email === id);
    if (existing) {
      Object.assign(existing, updates);
    }
    return res.json({ success: true, offline: true, teamMember: existing || updates });
  });

  app.delete("/api/team/:id", async (req, res) => {
    const id = req.params.id;
    try {
      const result = await deleteTeamMemberHandler({
        httpMethod: "DELETE",
        path: `/team/${id}`,
        pathParameters: { id },
        headers: req.headers as Record<string, string | undefined>,
      });
      let responseData: any;
      try {
        responseData = JSON.parse(result.body);
      } catch {
        responseData = { message: result.body };
      }
      if (result.statusCode >= 200 && result.statusCode < 300 && responseData?.success) {
        return res.status(200).json({
          success: true,
          offline: false,
          id: responseData.id || id,
        });
      }
    } catch (error: any) {
      console.warn("DELETE /api/team/:id DB error, falling back:", error?.message);
    }

    fallbackTeamMembers = fallbackTeamMembers.filter((m) => m.id !== id && m.email !== id);
    return res.json({ success: true, offline: true, id });
  });

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
      if (result.statusCode >= 200 && result.statusCode < 300) {
        return res.status(result.statusCode).json(responseData);
      }
      return res.json({
        success: true,
        offline: true,
        summary: {
          messages: 24800000,
          apiRequests: 51200000,
          automations: 642000,
          storageGb: 18400,
          activeConversations: 8240,
        },
      });
    } catch {
      return res.json({
        success: true,
        offline: true,
        summary: {
          messages: 24800000,
          apiRequests: 51200000,
          automations: 642000,
          storageGb: 18400,
          activeConversations: 8240,
        },
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
      if (result.statusCode >= 200 && result.statusCode < 300 && responseData?.success) {
        return res.status(result.statusCode).json({
          ...responseData,
          offline: false,
        });
      }
      return res.status(200).json({ success: true, count: 0, offerings: [], offline: true });
    } catch (error: any) {
      console.error("Error fetching customer offerings:", error);
      return res.status(200).json({ success: true, count: 0, offerings: [], offline: true });
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
      if (result.statusCode >= 200 && result.statusCode < 300 && responseData?.success) {
        return res.status(result.statusCode).json({
          ...responseData,
          offline: false,
        });
      }
      const bodyObj = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      return res.status(200).json({
        success: true,
        offline: true,
        offering: {
          id: `offering-${Date.now()}`,
          customer_id: bodyObj.customerId || bodyObj.customer_id,
          offering_name: bodyObj.offeringName || "Custom Offering",
          status: bodyObj.status || "Active",
          start_date: bodyObj.startDate || new Date().toISOString(),
          end_date: bodyObj.endDate || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error("Error creating customer offering:", error);
      const bodyObj = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      return res.status(200).json({
        success: true,
        offline: true,
        offering: {
          id: `offering-${Date.now()}`,
          customer_id: bodyObj.customerId || bodyObj.customer_id,
          offering_name: bodyObj.offeringName || "Custom Offering",
          status: bodyObj.status || "Active",
          start_date: bodyObj.startDate || new Date().toISOString(),
          end_date: bodyObj.endDate || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
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
