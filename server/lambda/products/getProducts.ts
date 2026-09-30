import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  ProductRecord,
  GetProductsResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

function mapProductRow(r: any): ProductRecord {
  return {
    id: r.id,
    client_id: r.client_id || "",
    client_user_id: r.client_user_id || "",
    name: r.name,
    description: r.description || null,
    category: r.category || "General",
    hsn: r.hsn || null,
    barcode_type: r.barcode_type || null,
    barcode_value: r.barcode_value || null,
    billing: r.billing || "Usage based",
    cost: Number(r.cost) || 0,
    currency: r.currency || "INR",
    active: Boolean(r.active ?? true),
    created_by: r.created_by || null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    price: Number(r.price) || 0,
    sku: r.sku || null,
    margin: r.margin || null,
    tax_rate: r.tax_rate != null ? Number(r.tax_rate) : 18,
    unit: r.unit || "unit",
    track_inventory: Boolean(r.track_inventory ?? false),
    stock: Number(r.stock) || 0,
  };
}

export async function getProductsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const params = event.queryStringParameters || {};
    const pathParams = event.pathParameters || {};
    const customerId = (
      params.customerId ||
      params.customer_id ||
      params.clientUserId ||
      params.client_user_id ||
      pathParams.customerId ||
      pathParams.id ||
      ""
    ).trim();

    if (!customerId) {
      const allSql = `
        SELECT 
          id, client_id, client_user_id, name, description, category, hsn,
          barcode_type, barcode_value, billing, cost, currency,
          active, created_by, created_at, updated_at, price,
          sku, margin, tax_rate, unit, track_inventory, stock
        FROM public.products
        ORDER BY created_at DESC;
      `;
      const allResult = await query(allSql);
      const mapped = allResult.rows.map(mapProductRow);

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          count: mapped.length,
          customerId: "",
          products: mapped,
        } as GetProductsResponse),
      };
    }

    const sql = `
      SELECT 
        id, client_id, client_user_id, name, description, category, hsn,
        barcode_type, barcode_value, billing, cost, currency,
        active, created_by, created_at, updated_at, price,
        sku, margin, tax_rate, unit, track_inventory, stock
      FROM public.products
      WHERE LOWER(client_user_id) = LOWER($1)
         OR LOWER(client_id) = LOWER($1)
         OR LOWER(id) = LOWER($1)
      ORDER BY created_at DESC;
    `;

    const result = await query(sql, [customerId]);
    const mapped = result.rows.map(mapProductRow);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        count: mapped.length,
        customerId,
        products: mapped,
      } as GetProductsResponse),
    };
  } catch (error: any) {
    console.error("Error executing getProductsHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        count: 0,
        customerId: "",
        products: [],
        error: error.message || "Failed to retrieve products",
      } as GetProductsResponse),
    };
  }
}
