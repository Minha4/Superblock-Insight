import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  DeleteProductResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "DELETE,OPTIONS",
};

export async function deleteProductHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const pathParams = event.pathParameters || {};
    const queryParams = event.queryStringParameters || {};
    let bodyId = "";
    if (event.body) {
      try {
        const parsed = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
        bodyId = parsed.id || "";
      } catch {}
    }

    const productId = (
      pathParams.id ||
      pathParams.productId ||
      queryParams.id ||
      bodyId
    ).trim();

    if (!productId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required product ID",
        } as DeleteProductResponse),
      };
    }

    const delSql = "DELETE FROM public.products WHERE id = $1 RETURNING id;";
    const result = await query(delSql, [productId]);

    if (result.rows.length === 0) {
      // Check if deleted by name as fallback
      const delNameSql = "DELETE FROM public.products WHERE name = $1 RETURNING id;";
      const nameResult = await query(delNameSql, [productId]);
      if (nameResult.rows.length === 0) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            success: false,
            error: `Product not found with ID '${productId}'`,
          } as DeleteProductResponse),
        };
      }
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: true,
          id: nameResult.rows[0].id,
        } as DeleteProductResponse),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        id: result.rows[0].id,
      } as DeleteProductResponse),
    };
  } catch (error: any) {
    console.error("Error executing deleteProductHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to delete product",
      } as DeleteProductResponse),
    };
  }
}
