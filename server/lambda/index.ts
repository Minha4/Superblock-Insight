import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "./types";
import { getNotesHandler } from "./notes/getNotes";
import { createNoteHandler } from "./notes/createNote";
import { deleteNoteHandler } from "./notes/deleteNote";
import { updateNoteHandler } from "./notes/updateNote";
import {
  getCustomerDetailsHandler,
  listCustomerDetailsHandler,
} from "./customerDetails/getCustomerDetails";
import { getMeetingsHandler } from "./meetings/getMeetings";
import { createMeetingHandler } from "./meetings/createMeeting";
import { deleteMeetingHandler } from "./meetings/deleteMeeting";
import { updateMeetingHandler } from "./meetings/updateMeeting";
import { getContactsHandler } from "./contacts/getContacts";
import { createContactHandler } from "./contacts/createContact";
import { getDealsHandler } from "./deals/getDeals";
import { createDealHandler } from "./deals/createDeal";
import { getTicketsHandler } from "./tickets/getTickets";
import { createTicketHandler } from "./tickets/createTicket";
import { getTeamMembersHandler } from "./teamMembers/getTeamMembers";
import { createTeamMemberHandler } from "./teamMembers/createTeamMember";
import { updateTeamMemberHandler } from "./teamMembers/updateTeamMember";
import { deleteTeamMemberHandler } from "./teamMembers/deleteTeamMember";
import { getProductsHandler } from "./products/getProducts";
import { createProductHandler } from "./products/createProduct";
import { updateProductHandler } from "./products/updateProduct";
import { deleteProductHandler } from "./products/deleteProduct";
import { getSubscriptionsHandler } from "./subscriptions/getSubscriptions";
import { createSubscriptionHandler } from "./subscriptions/createSubscription";
import { updateSubscriptionHandler } from "./subscriptions/updateSubscription";
import { deleteSubscriptionHandler } from "./subscriptions/deleteSubscription";
import { getCustomerOfferingsHandler } from "./customerOfferings/getCustomerOfferings";
import { createCustomerOfferingHandler } from "./customerOfferings/createCustomerOffering";
import { getInvoicesHandler } from "./invoices/getInvoices";
import { createInvoiceHandler } from "./invoices/createInvoice";
import { updateInvoiceHandler } from "./invoices/updateInvoice";
import { deleteInvoiceHandler } from "./invoices/deleteInvoice";
import { getPlansHandler } from "./plans/getPlans";
import { createPlanHandler } from "./plans/createPlan";
import { updatePlanHandler } from "./plans/updatePlan";
import { deletePlanHandler } from "./plans/deletePlan";
import { getDynamoMessagesUsageHandler } from "./usageMetrics/getDynamoMessagesUsage";
import { getBroadcastUsageHandler } from "./usageMetrics/getBroadcastUsage";
import { getActivitiesHandler } from "./activities/getActivities";
import { createActivityHandler } from "./activities/createActivity";
import { getCredentialsHandler } from "./credentials/getCredentials";
import { getCustomerOperations } from "../analyticsDb";

export * from "./types";
export * from "./db";
export * from "./dynamodb";
export { getCredentialsHandler } from "./credentials/getCredentials";
export { getNotesHandler } from "./notes/getNotes";
export { createNoteHandler } from "./notes/createNote";
export { deleteNoteHandler } from "./notes/deleteNote";
export { updateNoteHandler } from "./notes/updateNote";
export {
  getCustomerDetailsHandler,
  listCustomerDetailsHandler,
} from "./customerDetails/getCustomerDetails";
export { getMeetingsHandler } from "./meetings/getMeetings";
export { createMeetingHandler } from "./meetings/createMeeting";
export { deleteMeetingHandler } from "./meetings/deleteMeeting";
export { updateMeetingHandler } from "./meetings/updateMeeting";
export { getContactsHandler } from "./contacts/getContacts";
export { createContactHandler } from "./contacts/createContact";
export { getDealsHandler } from "./deals/getDeals";
export { createDealHandler } from "./deals/createDeal";
export { getTicketsHandler } from "./tickets/getTickets";
export { createTicketHandler } from "./tickets/createTicket";
export { getTeamMembersHandler } from "./teamMembers/getTeamMembers";
export { createTeamMemberHandler } from "./teamMembers/createTeamMember";
export { updateTeamMemberHandler } from "./teamMembers/updateTeamMember";
export { deleteTeamMemberHandler } from "./teamMembers/deleteTeamMember";
export { getProductsHandler } from "./products/getProducts";
export { createProductHandler } from "./products/createProduct";
export { updateProductHandler } from "./products/updateProduct";
export { deleteProductHandler } from "./products/deleteProduct";
export { getSubscriptionsHandler } from "./subscriptions/getSubscriptions";
export { createSubscriptionHandler } from "./subscriptions/createSubscription";
export { updateSubscriptionHandler } from "./subscriptions/updateSubscription";
export { deleteSubscriptionHandler } from "./subscriptions/deleteSubscription";
export { getCustomerOfferingsHandler } from "./customerOfferings/getCustomerOfferings";
export { createCustomerOfferingHandler } from "./customerOfferings/createCustomerOffering";
export { deleteCustomerOfferingHandler } from "./customerOfferings/deleteCustomerOffering";
export { getInvoicesHandler } from "./invoices/getInvoices";
export { createInvoiceHandler } from "./invoices/createInvoice";
export { updateInvoiceHandler } from "./invoices/updateInvoice";
export { deleteInvoiceHandler } from "./invoices/deleteInvoice";
export { getPlansHandler } from "./plans/getPlans";
export { createPlanHandler } from "./plans/createPlan";
export { updatePlanHandler } from "./plans/updatePlan";
export { deletePlanHandler } from "./plans/deletePlan";
export { getDynamoMessagesUsageHandler } from "./usageMetrics/getDynamoMessagesUsage";
export { getBroadcastUsageHandler } from "./usageMetrics/getBroadcastUsage";
export { getActivitiesHandler } from "./activities/getActivities";
export { createActivityHandler } from "./activities/createActivity";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT",
};

/**
 * Unified Lambda entrypoint router.
 * Dispatches API Gateway requests based on HTTP method and path,
 * or allows calling individual handlers directly.
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const method = (
      event.httpMethod ||
      event.requestContext?.http?.method ||
      "GET"
    ).toUpperCase();
    const rawPath = (
      event.path ||
      event.rawPath ||
      event.requestContext?.http?.path ||
      "/"
    ).toLowerCase();

    // Handle CORS Preflight
    if (method === "OPTIONS") {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: "OK" }),
      };
    }

    // Extract query parameter action / resource
    const action = (
      event.queryStringParameters?.action ||
      event.queryStringParameters?.resource ||
      event.queryStringParameters?.path ||
      ""
    ).toLowerCase().replace(/^\/+/, "");

    // 0. Root Health Check / Introspection Route
    const isRootRequest =
      rawPath === "/" ||
      rawPath === "" ||
      rawPath.endsWith("/customeranalyticsdashaboard") ||
      rawPath.endsWith("/customeranalyticsdashboard");

    if (method === "GET" && isRootRequest && !action) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          status: "healthy",
          message: "Superblock Analytics Dashboard API is live",
          timestamp: new Date().toISOString(),
          version: "1.0.0",
          supportedEntities: [
            "notes",
            "meetings",
            "customerDetails",
            "contacts",
            "deals",
            "tickets",
            "teamMembers",
            "products",
            "subscriptions",
            "customerOfferings",
            "invoices",
            "usageMetrics",
            "dynamoMessagesUsage",
            "activities",
          ],
        }),
      };
    }

    // 1. Notes API
    if (
      (method === "GET" && (rawPath.endsWith("/notes") || rawPath.includes("/notes/"))) ||
      (method === "GET" && (action === "notes" || action === "get_notes"))
    ) {
      return await getNotesHandler(event);
    }
    if (
      (method === "POST" && rawPath.endsWith("/notes")) ||
      (method === "POST" && (
        action === "notes" ||
        action === "create_note" ||
        rawPath.endsWith("/customeranalytics") ||
        rawPath.endsWith("/customer-analytics")
      ))
    ) {
      return await createNoteHandler(event);
    }
    if (
      (method === "DELETE" && (rawPath.includes("/notes/") || rawPath.endsWith("/notes"))) ||
      (method === "DELETE" && (action === "delete_note" || action === "notes"))
    ) {
      return await deleteNoteHandler(event);
    }
    if (
      ((method === "PUT" || method === "PATCH") && (rawPath.includes("/notes/") || rawPath.endsWith("/notes"))) ||
      ((method === "PUT" || method === "PATCH") && (action === "update_note" || action === "notes"))
    ) {
      return await updateNoteHandler(event);
    }

    // 2. Customer Details API
    if (
      (method === "GET" && (rawPath.includes("/customer-details") || rawPath.includes("/customer_details"))) ||
      (method === "GET" && (action === "customer_details" || action === "customerdetails" || action === "customer-details"))
    ) {
      if (
        event.pathParameters?.id ||
        event.pathParameters?.customerId ||
        event.queryStringParameters?.id ||
        event.queryStringParameters?.customerId ||
        event.queryStringParameters?.clientUserId
      ) {
        return await getCustomerDetailsHandler(event);
      }
      return await listCustomerDetailsHandler(event);
    }

    // 3. Meetings API
    if (
      (method === "GET" && (rawPath.endsWith("/meetings") || rawPath.includes("/meetings/"))) ||
      (method === "GET" && (action === "meetings" || action === "get_meetings"))
    ) {
      return await getMeetingsHandler(event);
    }
    if (
      (method === "POST" && rawPath.endsWith("/meetings")) ||
      (method === "POST" && (action === "meetings" || action === "create_meeting"))
    ) {
      return await createMeetingHandler(event);
    }
    if (
      (method === "DELETE" && (rawPath.includes("/meetings/") || rawPath.endsWith("/meetings"))) ||
      (method === "DELETE" && (action === "delete_meeting" || action === "meetings"))
    ) {
      return await deleteMeetingHandler(event);
    }
    if (
      ((method === "PUT" || method === "PATCH") && (rawPath.includes("/meetings/") || rawPath.endsWith("/meetings"))) ||
      ((method === "PUT" || method === "PATCH") && (action === "update_meeting" || action === "meetings"))
    ) {
      return await updateMeetingHandler(event);
    }

    // 4. Contacts API
    if (
      (method === "GET" && (rawPath.endsWith("/contacts") || rawPath.includes("/contacts/"))) ||
      (method === "GET" && (action === "contacts" || action === "get_contacts"))
    ) {
      return await getContactsHandler(event);
    }
    if (
      (method === "POST" && rawPath.endsWith("/contacts")) ||
      (method === "POST" && (action === "contacts" || action === "create_contact"))
    ) {
      return await createContactHandler(event);
    }

    // 5. Deals API
    if (
      (method === "GET" && (rawPath.endsWith("/deals") || rawPath.includes("/deals/"))) ||
      (method === "GET" && (action === "deals" || action === "get_deals"))
    ) {
      return await getDealsHandler(event);
    }
    if (
      (method === "POST" && rawPath.endsWith("/deals")) ||
      (method === "POST" && (action === "deals" || action === "create_deal"))
    ) {
      return await createDealHandler(event);
    }

    // 6. Tickets API
    if (
      (method === "GET" && (rawPath.endsWith("/tickets") || rawPath.includes("/tickets/"))) ||
      (method === "GET" && (action === "tickets" || action === "get_tickets"))
    ) {
      return await getTicketsHandler(event);
    }
    if (
      (method === "POST" && rawPath.endsWith("/tickets")) ||
      (method === "POST" && (action === "tickets" || action === "create_ticket"))
    ) {
      return await createTicketHandler(event);
    }

    // 7. Team Members API
    if (
      (method === "GET" &&
        (rawPath.endsWith("/team-members") ||
          rawPath.includes("/team-members/") ||
          rawPath.endsWith("/team_members") ||
          rawPath.includes("/team_members/") ||
          rawPath.endsWith("/team") ||
          rawPath.includes("/team/"))) ||
      (method === "GET" && (action === "team_members" || action === "team-members" || action === "teammembers" || action === "team"))
    ) {
      return await getTeamMembersHandler(event);
    }
    if (
      (method === "POST" &&
        (rawPath.endsWith("/team-members") || rawPath.endsWith("/team_members") || rawPath.endsWith("/team"))) ||
      (method === "POST" && (action === "team_members" || action === "team-members" || action === "teammembers" || action === "team"))
    ) {
      return await createTeamMemberHandler(event);
    }
    if (
      (method === "PUT" &&
        (rawPath.includes("/team-members") || rawPath.includes("/team_members") || rawPath.includes("/team"))) ||
      (method === "PUT" && (action === "team_members" || action === "team-members" || action === "team"))
    ) {
      return await updateTeamMemberHandler(event);
    }
    if (
      (method === "DELETE" &&
        (rawPath.includes("/team-members") || rawPath.includes("/team_members") || rawPath.includes("/team"))) ||
      (method === "DELETE" && (action === "team_members" || action === "team-members" || action === "team"))
    ) {
      return await deleteTeamMemberHandler(event);
    }

    // 8. Products API
    if (
      (method === "GET" && (rawPath.endsWith("/products") || rawPath.includes("/products/"))) ||
      (method === "GET" && (action === "products" || action === "get_products"))
    ) {
      return await getProductsHandler(event);
    }
    if (
      (method === "POST" && rawPath.endsWith("/products")) ||
      (method === "POST" && (action === "products" || action === "create_product"))
    ) {
      return await createProductHandler(event);
    }
    if (
      (method === "PUT" && (rawPath.includes("/products/") || rawPath.endsWith("/products"))) ||
      (method === "PUT" && (action === "products" || action === "update_product"))
    ) {
      return await updateProductHandler(event);
    }
    if (
      (method === "DELETE" && (rawPath.includes("/products/") || rawPath.endsWith("/products"))) ||
      (method === "DELETE" && (action === "products" || action === "delete_product"))
    ) {
      return await deleteProductHandler(event);
    }

    // 9. Subscriptions API
    if (
      (method === "GET" &&
        (rawPath.endsWith("/subscriptions") || rawPath.includes("/subscriptions/"))) ||
      (method === "GET" && (action === "subscriptions" || action === "get_subscriptions"))
    ) {
      return await getSubscriptionsHandler(event);
    }
    if (
      (method === "POST" && rawPath.endsWith("/subscriptions")) ||
      (method === "POST" && (action === "subscriptions" || action === "create_subscription"))
    ) {
      return await createSubscriptionHandler(event);
    }
    if (
      (method === "PUT" && (rawPath.includes("/subscriptions/") || rawPath.endsWith("/subscriptions"))) ||
      (method === "PUT" && (action === "subscriptions" || action === "update_subscription"))
    ) {
      return await updateSubscriptionHandler(event);
    }
    if (
      (method === "DELETE" && (rawPath.includes("/subscriptions/") || rawPath.endsWith("/subscriptions"))) ||
      (method === "DELETE" && (action === "subscriptions" || action === "delete_subscription"))
    ) {
      return await deleteSubscriptionHandler(event);
    }

    // 10. Customer Offerings API
    if (
      (method === "GET" &&
        (rawPath.endsWith("/customer-offerings") ||
          rawPath.includes("/customer-offerings/") ||
          rawPath.endsWith("/customer_offerings") ||
          rawPath.includes("/customer_offerings/") ||
          rawPath.endsWith("/offerings") ||
          rawPath.includes("/offerings/"))) ||
      (method === "GET" && (action === "customer_offerings" || action === "customer-offerings" || action === "offerings"))
    ) {
      return await getCustomerOfferingsHandler(event);
    }
    if (
      (method === "POST" &&
        (rawPath.endsWith("/customer-offerings") ||
          rawPath.endsWith("/customer_offerings") ||
          rawPath.endsWith("/offerings"))) ||
      (method === "POST" && (action === "customer_offerings" || action === "customer-offerings" || action === "offerings"))
    ) {
      return await createCustomerOfferingHandler(event);
    }

    // 11. Invoices API
    if (
      (method === "GET" && (rawPath.endsWith("/invoices") || rawPath.includes("/invoices/"))) ||
      (method === "GET" && (action === "invoices" || action === "get_invoices"))
    ) {
      return await getInvoicesHandler(event);
    }
    if (
      (method === "POST" && rawPath.endsWith("/invoices")) ||
      (method === "POST" && (action === "invoices" || action === "create_invoice"))
    ) {
      return await createInvoiceHandler(event);
    }
    if (
      (method === "PUT" || method === "PATCH") &&
      (rawPath.endsWith("/invoices") || rawPath.includes("/invoices/"))
    ) {
      return await updateInvoiceHandler(event);
    }
    if (
      method === "DELETE" &&
      (rawPath.endsWith("/invoices") || rawPath.includes("/invoices/"))
    ) {
      return await deleteInvoiceHandler(event);
    }

    // 12. Plans API
    if (
      (method === "GET" && (rawPath.endsWith("/plans") || rawPath.includes("/plans/"))) ||
      (method === "GET" && (action === "plans" || action === "get_plans"))
    ) {
      return await getPlansHandler(event);
    }
    if (
      (method === "POST" && rawPath.endsWith("/plans")) ||
      (method === "POST" && (action === "plans" || action === "create_plan"))
    ) {
      return await createPlanHandler(event);
    }
    if (
      (method === "PUT" || method === "PATCH") &&
      (rawPath.endsWith("/plans") || rawPath.includes("/plans/"))
    ) {
      return await updatePlanHandler(event);
    }
    if (
      method === "DELETE" &&
      (rawPath.endsWith("/plans") || rawPath.includes("/plans/"))
    ) {
      return await deletePlanHandler(event);
    }

    // 12a. Broadcasts Usage API (Source of truth: PostgreSQL operational database public.broadcasts)
    if (
      (method === "GET" &&
        (rawPath.endsWith("/usage-metrics/broadcasts") ||
          rawPath.includes("/usage-metrics/broadcasts/") ||
          rawPath.endsWith("/broadcast-usage") ||
          rawPath.includes("/broadcast-usage/") ||
          rawPath.endsWith("/broadcasts-usage") ||
          rawPath.includes("/broadcasts-usage/") ||
          rawPath.endsWith("/broadcasts") ||
          rawPath.includes("/broadcasts/"))) ||
      (method === "GET" &&
        (action === "broadcast_usage" ||
          action === "broadcast-usage" ||
          action === "broadcasts_usage" ||
          action === "broadcasts-usage" ||
          action === "broadcasts" ||
          action === "broadcast"))
    ) {
      return await getBroadcastUsageHandler(event);
    }

    // 12. Usage Metrics API (Source of truth: AWS DynamoDB Messages table)
    if (
      (method === "GET" &&
        (rawPath.endsWith("/usage-metrics") ||
          rawPath.includes("/usage-metrics/") ||
          rawPath.endsWith("/usage_metrics") ||
          rawPath.includes("/usage_metrics/") ||
          rawPath.endsWith("/usage-metrics/messages") ||
          rawPath.includes("/usage-metrics/messages/") ||
          rawPath.endsWith("/messages-usage") ||
          rawPath.includes("/messages-usage/") ||
          rawPath.endsWith("/dynamo-messages") ||
          rawPath.includes("/dynamo-messages/"))) ||
      (method === "GET" &&
        (action === "usage_metrics" ||
          action === "usage-metrics" ||
          action === "usagemetrics" ||
          action === "messages_usage" ||
          action === "messages-usage" ||
          action === "messages" ||
          action === "dynamo_messages" ||
          action === "dynamodb_messages"))
    ) {
      return await getDynamoMessagesUsageHandler(event);
    }

    // 13. Activities API
    if (
      (method === "GET" &&
        (rawPath.endsWith("/activities") || rawPath.includes("/activities/"))) ||
      (method === "GET" && (action === "activities" || action === "get_activities"))
    ) {
      return await getActivitiesHandler(event);
    }
    if (
      (method === "POST" && rawPath.endsWith("/activities")) ||
      (method === "POST" && (action === "activities" || action === "create_activity"))
    ) {
      return await createActivityHandler(event);
    }

    // 14. Credentials API
    if (
      (method === "GET" &&
        (rawPath.endsWith("/credentials") || rawPath.includes("/credentials/"))) ||
      (method === "GET" && (
        action === "credentials" ||
        action === "credential" ||
        action === "customer_credentials" ||
        action === "customer-credentials" ||
        action === "get_credentials"
      ))
    ) {
      return await getCredentialsHandler(event);
    }

    // 15. Customer Operations API (Activities, Products, Deals, Tasks, Tickets, Contact Groups, Notes)
    if (
      (method === "GET" &&
        (rawPath.endsWith("/customer-operations") ||
          rawPath.includes("/customer-operations/") ||
          rawPath.endsWith("/customer_operations") ||
          rawPath.includes("/customer_operations/"))) ||
      (method === "GET" &&
        (action === "customer_operations" ||
          action === "customer-operations" ||
          action === "customeroperations" ||
          action === "operations"))
    ) {
      const customerId = (
        event.queryStringParameters?.customerId ||
        event.queryStringParameters?.customer_id ||
        event.queryStringParameters?.clientUserId ||
        event.queryStringParameters?.client_user_id ||
        event.queryStringParameters?.userId ||
        event.queryStringParameters?.user_id ||
        event.pathParameters?.customerId ||
        event.pathParameters?.id ||
        ""
      ).trim();
      const customerName = (
        event.queryStringParameters?.customerName ||
        event.queryStringParameters?.customer_name ||
        ""
      ).trim();

      const ops = await getCustomerOperations(customerId, customerName);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          customerId: customerId || undefined,
          ...ops,
        }),
      };
    }

    // Fallback 404
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: `Route not found for method ${method} at path ${rawPath}${action ? ` with action=${action}` : ""}`,
      }),
    };
  } catch (error: any) {
    console.error("Top-level unhandled Lambda error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error?.message || "Internal server error occurred",
        stack: process.env.NODE_ENV === "development" ? error?.stack : undefined,
      }),
    };
  }
}
