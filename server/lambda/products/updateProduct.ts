import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  ProductRecord,
  UpdateProductInput,
  UpdateProductResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "PUT,OPTIONS",
};

export async function updateProductHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const pathParams = event.pathParameters || {};
    let payload: UpdateProductInput = {};
    if (event.body) {
      try {
        payload =
          typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      } catch {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            error: "Invalid JSON format in request body",
          } as UpdateProductResponse),
        };
      }
    }

    const productId = (
      pathParams.id ||
      pathParams.productId ||
      (payload as any).id ||
      ""
    ).trim();

    if (!productId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required product ID",
        } as UpdateProductResponse),
      };
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (payload.name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      values.push(payload.name.trim());
    }
    if (payload.category !== undefined) {
      setClauses.push(`category = $${idx++}`);
      values.push(payload.category);
    }
    if (payload.billing !== undefined || payload.model !== undefined) {
      setClauses.push(`billing = $${idx++}`);
      values.push(payload.billing ?? payload.model);
    }
    if (payload.description !== undefined) {
      setClauses.push(`description = $${idx++}`);
      values.push(payload.description);
    }
    if (payload.price !== undefined) {
      setClauses.push(`price = $${idx++}`);
      values.push(Number(payload.price) || 0);
    }
    if (payload.cost !== undefined) {
      setClauses.push(`cost = $${idx++}`);
      values.push(Number(payload.cost) || 0);
    }
    if (payload.currency !== undefined) {
      setClauses.push(`currency = $${idx++}`);
      values.push(payload.currency);
    }
    if (payload.active !== undefined) {
      setClauses.push(`active = $${idx++}`);
      values.push(Boolean(payload.active));
    } else if (payload.status !== undefined) {
      setClauses.push(`active = $${idx++}`);
      values.push(payload.status !== "Archived");
    }
    if (payload.sku !== undefined) {
      setClauses.push(`sku = $${idx++}`);
      values.push(payload.sku);
    }
    if (payload.margin !== undefined) {
      setClauses.push(`margin = $${idx++}`);
      values.push(payload.margin);
    }
    if (payload.taxRate !== undefined || payload.tax_rate !== undefined) {
      setClauses.push(`tax_rate = $${idx++}`);
      values.push(Number(payload.taxRate ?? payload.tax_rate) || 0);
    }
    if (payload.unit !== undefined) {
      setClauses.push(`unit = $${idx++}`);
      values.push(payload.unit);
    }
    if (payload.trackInventory !== undefined || payload.track_inventory !== undefined) {
      setClauses.push(`track_inventory = $${idx++}`);
      values.push(Boolean(payload.trackInventory ?? payload.track_inventory));
    }
    if (payload.stock !== undefined) {
      setClauses.push(`stock = $${idx++}`);
      values.push(Number(payload.stock) || 0);
    }

    setClauses.push(`updated_at = NOW()`);

    if (setClauses.length === 1) {
      // Only updated_at
      const findRes = await query("SELECT * FROM public.products WHERE id = $1;", [productId]);
      if (findRes.rows.length === 0) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            error: `Product not found with ID '${productId}'`,
          } as UpdateProductResponse),
        };
      }
    }

    values.push(productId);
    const updateSql = `
      UPDATE public.products
      SET ${setClauses.join(", ")}
      WHERE id = $${idx}
      RETURNING 
        id, client_id, client_user_id, name, description, category, hsn,
        barcode_type, barcode_value, billing, cost, currency, active,
        created_by, created_at, updated_at, price, sku, margin,
        tax_rate, unit, track_inventory, stock;
    `;

    const result = await query(updateSql, values);
    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Product not found with ID '${productId}'`,
        } as UpdateProductResponse),
      };
    }

    const r = result.rows[0];
    const updatedProduct: ProductRecord = {
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

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        product: updatedProduct,
      } as UpdateProductResponse),
    };
  } catch (error: any) {
    console.error("Error executing updateProductHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to update product",
      } as UpdateProductResponse),
    };
  }
}
