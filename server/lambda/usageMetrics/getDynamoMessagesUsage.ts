import {
  QueryCommand,
  ScanCommand,
  type QueryCommandInput,
  type ScanCommandInput,
} from "@aws-sdk/lib-dynamodb";
import {
  getDynamoDocClient,
  getMessagesTableName,
  getMessagesIndexName,
  getMessagesIndexKey,
} from "../dynamodb";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  DynamoDbMessageRecord,
  DynamoMessageMetrics,
  DynamoMessageDirectionBreakdown,
  DynamoMessageDailyCount,
  DynamoMessageRecentItem,
  GetDynamoMessagesUsageResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

/**
 * Normalizes an arbitrary timestamp (which may be in seconds or milliseconds)
 * into milliseconds since epoch.
 */
function toEpochMs(ts?: number | string | null): number | null {
  if (ts === null || ts === undefined || ts === "") return null;
  const num = typeof ts === "string" ? Number(ts) : ts;
  if (isNaN(num) || num <= 0) return null;
  // If 10-digit timestamp (seconds), scale to ms
  if (num < 1e11) {
    return Math.floor(num * 1000);
  }
  return Math.floor(num);
}

/**
 * Formats epoch ms into YYYY-MM-DD UTC date string.
 */
function toUtcDateString(ms: number): string {
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Safe, read-only AWS Lambda handler for Analytics Studio Usage Metrics
 * backed directly by the AWS DynamoDB Messages table.
 *
 * Supports:
 * - Customer query: by customerId, customer_id, clientUserId, client_user_id, or userId
 * - Query mode: Uses Global Secondary Index (GSI) if configured, or safe FilterExpression Scan
 * - Optional time filtering: startDate/endDate or from/to timestamps
 * - Clean JSON response with real counts, status/type/direction breakdowns, and daily distribution
 */
export async function getDynamoMessagesUsageHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const queriedAt = new Date().toISOString();
  const tableName = getMessagesTableName();
  const configuredIndexName = getMessagesIndexName();
  const configuredIndexKey = getMessagesIndexKey();

  let customerId = "";
  let scope: "customer" | "platform" = "customer";

  try {
    const params = event.queryStringParameters || {};
    const pathParams = event.pathParameters || {};

    // 1. Resolve customer identifier
    customerId = (
      params.customerId ||
      params.customer_id ||
      params.clientUserId ||
      params.client_user_id ||
      params.userId ||
      params.user_id ||
      pathParams.customerId ||
      pathParams.id ||
      ""
    ).trim();

    // If request body contains customerId (for POST invocations)
    if (!customerId && event.body) {
      try {
        const parsedBody = JSON.parse(event.body);
        customerId = (
          parsedBody.customerId ||
          parsedBody.customer_id ||
          parsedBody.clientUserId ||
          parsedBody.client_user_id ||
          parsedBody.userId ||
          parsedBody.user_id ||
          ""
        ).trim();
      } catch {
        // Body was not JSON; ignore
      }
    }

    scope = customerId ? "customer" : "platform";

    // 2. Resolve optional query parameters
    const limitParam = params.limit ? parseInt(params.limit, 10) : 5000;
    const limit = isNaN(limitParam) || limitParam <= 0 ? 5000 : Math.min(limitParam, 25000);

    const fromDateParam = params.from || params.startDate || params.start_date;
    const toDateParam = params.to || params.endDate || params.end_date;

    const fromTs = fromDateParam
      ? (isNaN(Number(fromDateParam)) ? Date.parse(fromDateParam) : toEpochMs(Number(fromDateParam)))
      : null;
    const toTs = toDateParam
      ? (isNaN(Number(toDateParam)) ? Date.parse(toDateParam) : toEpochMs(Number(toDateParam)))
      : null;

    const requestedIndex = params.indexName || params.index_name || configuredIndexName;

    const docClient = getDynamoDocClient();
    const rawItems: DynamoDbMessageRecord[] = [];
    let queryMode: "query_index" | "scan_filter" = "scan_filter";
    let indexUsed: string | null = null;
    let warning: string | undefined;

    // 3. Execution Strategy:
    // If an index is configured AND customerId is provided, attempt QueryCommand on the GSI.
    // If no index is configured or the Query fails because the index doesn't exist, safely Scan with FilterExpression.
    if (requestedIndex && scope === "customer") {
      try {
        const queryInput: QueryCommandInput = {
          TableName: tableName,
          IndexName: requestedIndex,
          KeyConditionExpression: "#idxKey = :cuidVal",
          ExpressionAttributeNames: {
            "#idxKey": configuredIndexKey,
          },
          ExpressionAttributeValues: {
            ":cuidVal": customerId,
          },
          Limit: limit,
        };

        if (fromTs !== null && toTs !== null) {
          queryInput.FilterExpression = "#ts BETWEEN :fromTs AND :toTs";
          queryInput.ExpressionAttributeNames!["#ts"] = "timestamp";
          queryInput.ExpressionAttributeValues![":fromTs"] = fromTs;
          queryInput.ExpressionAttributeValues![":toTs"] = toTs;
        } else if (fromTs !== null) {
          queryInput.FilterExpression = "#ts >= :fromTs";
          queryInput.ExpressionAttributeNames!["#ts"] = "timestamp";
          queryInput.ExpressionAttributeValues![":fromTs"] = fromTs;
        } else if (toTs !== null) {
          queryInput.FilterExpression = "#ts <= :toTs";
          queryInput.ExpressionAttributeNames!["#ts"] = "timestamp";
          queryInput.ExpressionAttributeValues![":toTs"] = toTs;
        }

        let lastEvaluatedKey: Record<string, any> | undefined = undefined;
        let iterations = 0;
        const maxQueryIterations = 15;

        do {
          const currentInput: QueryCommandInput = {
            ...queryInput,
            ExclusiveStartKey: lastEvaluatedKey,
          };
          const result = await docClient.send(new QueryCommand(currentInput));
          if (result.Items && result.Items.length > 0) {
            rawItems.push(...(result.Items as DynamoDbMessageRecord[]));
          }
          lastEvaluatedKey = result.LastEvaluatedKey;
          iterations++;
        } while (lastEvaluatedKey && rawItems.length < limit && iterations < maxQueryIterations);

        queryMode = "query_index";
        indexUsed = requestedIndex;
      } catch (queryErr: any) {
        // If the table does not have the specified index, do not fail: fall back to safe Scan
        console.warn(
          `DynamoDB Query on index '${requestedIndex}' notice: ${queryErr?.message || queryErr}. Falling back to Scan with FilterExpression.`
        );
        warning = `Index '${requestedIndex}' was not available on table '${tableName}'. Safely fell back to bounded table scan with FilterExpression.`;
        queryMode = "scan_filter";
        indexUsed = null;
      }
    }

    // 4. Fallback or Default: Bounded ScanCommand with FilterExpression
    if (queryMode === "scan_filter") {
      const scanInput: ScanCommandInput = {
        TableName: tableName,
        Limit: Math.min(limit, 1000),
      };

      const exprNames: Record<string, string> = {};
      const exprValues: Record<string, any> = {};
      const filterConditions: string[] = [];

      if (scope === "customer") {
        // Safely map ExpressionAttributeNames to handle '#' character in 'client#user_id'
        exprNames["#cuid"] = "client#user_id";
        exprNames["#uid"] = "user_id";
        exprValues[":cid"] = customerId;
        exprValues[":cprefix"] = `${customerId}#`;
        exprValues[":csuffix"] = `#${customerId}`;

        // Match exact client#user_id, exact user_id, client prefix with '#', or user_id suffix after '#'
        filterConditions.push(
          "(#cuid = :cid OR #uid = :cid OR begins_with(#cuid, :cprefix) OR contains(#cuid, :csuffix))"
        );
      }

      if (fromTs !== null && toTs !== null) {
        exprNames["#ts"] = "timestamp";
        exprValues[":fromTs"] = fromTs;
        exprValues[":toTs"] = toTs;
        filterConditions.push("(#ts BETWEEN :fromTs AND :toTs)");
      } else if (fromTs !== null) {
        exprNames["#ts"] = "timestamp";
        exprValues[":fromTs"] = fromTs;
        filterConditions.push("(#ts >= :fromTs)");
      } else if (toTs !== null) {
        exprNames["#ts"] = "timestamp";
        exprValues[":toTs"] = toTs;
        filterConditions.push("(#ts <= :toTs)");
      }

      if (filterConditions.length > 0) {
        scanInput.FilterExpression = filterConditions.join(" AND ");
        scanInput.ExpressionAttributeNames = exprNames;
        scanInput.ExpressionAttributeValues = exprValues;
      }

      let lastEvaluatedKey: Record<string, any> | undefined = undefined;
      let iterations = 0;
      const maxScanIterations = 20;

      do {
        const currentInput: ScanCommandInput = {
          ...scanInput,
          ExclusiveStartKey: lastEvaluatedKey,
        };
        const result = await docClient.send(new ScanCommand(currentInput));
        if (result.Items && result.Items.length > 0) {
          rawItems.push(...(result.Items as DynamoDbMessageRecord[]));
        }
        lastEvaluatedKey = result.LastEvaluatedKey;
        iterations++;
      } while (lastEvaluatedKey && rawItems.length < limit && iterations < maxScanIterations);
    }

    // 5. Strict Customer Post-Filter:
    // Ensures 100% boundary isolation so no other customer's messages can ever be counted.
    const matchedItems: DynamoDbMessageRecord[] = [];
    if (scope === "customer") {
      const target = customerId.trim().toLowerCase();
      for (const item of rawItems) {
        const itemCuid = (item["client#user_id"] || item.client_user_id || "").trim().toLowerCase();
        const itemUid = (item.user_id || "").trim().toLowerCase();

        // Exact match on user_id or client#user_id
        if (itemUid === target || itemCuid === target) {
          matchedItems.push(item);
          continue;
        }

        // Composite match on <client>#<user_id>
        if (itemCuid.includes("#")) {
          const parts = itemCuid.split("#");
          const clientPart = (parts[0] || "").trim();
          const userPart = (parts[1] || "").trim();
          if (clientPart === target || userPart === target) {
            matchedItems.push(item);
            continue;
          }
        }
      }
    } else {
      matchedItems.push(...rawItems);
    }

    // 6. Aggregate Real Message Metrics
    let inboundCount = 0;
    let outboundCount = 0;
    let otherDirCount = 0;
    let mediaCount = 0;

    const statusBreakdown: Record<string, number> = {};
    const typeBreakdown: Record<string, number> = {};
    const dailyMap: Map<string, { inbound: number; outbound: number; total: number }> = new Map();

    let earliestTsMs: number | null = null;
    let latestTsMs: number | null = null;

    for (const item of matchedItems) {
      // Direction
      const dir = (item.direction || "").trim().toLowerCase();
      if (dir === "inbound" || dir === "in" || dir === "incoming") {
        inboundCount++;
      } else if (dir === "outbound" || dir === "out" || dir === "outgoing") {
        outboundCount++;
      } else {
        otherDirCount++;
      }

      // Status
      const status = (item.messageStatus || "unknown").trim().toLowerCase();
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;

      // Message Type
      const mType = (item.message_type || "unknown").trim().toLowerCase();
      typeBreakdown[mType] = (typeBreakdown[mType] || 0) + 1;

      // Media URL
      if (item.media_url && typeof item.media_url === "string" && item.media_url.trim().length > 0) {
        mediaCount++;
      }

      // Timestamp
      const tsMs = toEpochMs(item.timestamp);
      if (tsMs !== null) {
        if (earliestTsMs === null || tsMs < earliestTsMs) {
          earliestTsMs = tsMs;
        }
        if (latestTsMs === null || tsMs > latestTsMs) {
          latestTsMs = tsMs;
        }

        // Daily breakdown
        const dateKey = toUtcDateString(tsMs);
        const currentDaily = dailyMap.get(dateKey) || { inbound: 0, outbound: 0, total: 0 };
        currentDaily.total++;
        if (dir === "inbound" || dir === "in" || dir === "incoming") {
          currentDaily.inbound++;
        } else if (dir === "outbound" || dir === "out" || dir === "outgoing") {
          currentDaily.outbound++;
        }
        dailyMap.set(dateKey, currentDaily);
      }
    }

    // Sort daily breakdown chronologically
    const dailyBreakdown: DynamoMessageDailyCount[] = Array.from(dailyMap.entries())
      .map(([date, counts]) => ({
        date,
        inbound: counts.inbound,
        outbound: counts.outbound,
        total: counts.total,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Sort recent messages by timestamp descending (take top 20)
    const recentMessages: DynamoMessageRecentItem[] = matchedItems
      .slice()
      .sort((a, b) => {
        const aTs = toEpochMs(a.timestamp) || 0;
        const bTs = toEpochMs(b.timestamp) || 0;
        return bTs - aTs;
      })
      .slice(0, 20)
      .map((m) => {
        const tsMs = toEpochMs(m.timestamp);
        let snippet: string | undefined = undefined;
        if (m.message_text && typeof m.message_text === "string") {
          snippet = m.message_text.length > 120 ? `${m.message_text.slice(0, 120)}...` : m.message_text;
        }

        return {
          message_id: m.message_id,
          direction: m.direction,
          message_type: m.message_type,
          messageStatus: m.messageStatus,
          timestamp: m.timestamp,
          formattedTime: tsMs !== null ? new Date(tsMs).toISOString() : undefined,
          snippet,
          hasMedia: Boolean(m.media_url && typeof m.media_url === "string" && m.media_url.trim().length > 0),
          media_url: m.media_url || undefined,
        };
      });

    const directionBreakdown: DynamoMessageDirectionBreakdown = {
      inbound: inboundCount,
      outbound: outboundCount,
      other: otherDirCount,
    };

    const totalMessages = matchedItems.length;

    const metrics: DynamoMessageMetrics = {
      totalMessages,
      inboundMessages: inboundCount,
      outboundMessages: outboundCount,
      mediaMessages: mediaCount,
      directionBreakdown,
      statusBreakdown,
      typeBreakdown,
      firstMessageAt: earliestTsMs !== null ? new Date(earliestTsMs).toISOString() : null,
      lastMessageAt: latestTsMs !== null ? new Date(latestTsMs).toISOString() : null,
      firstMessageTimestamp: earliestTsMs,
      lastMessageTimestamp: latestTsMs,
      dailyBreakdown,
      recentMessages,
      planAllowance: null,
      quotaRemaining: null,
      conversationsCount: null,
      broadcastsCount: null,
      costEstimate: null,
      note: "Real WhatsApp message metrics aggregated directly from AWS DynamoDB Messages table. Plan allowance and conversations count are not stored in Messages and remain null.",
    };

    // Compatibility breakdown for seamless integration with existing Analytics Studio usage components
    const metricBreakdown: GetDynamoMessagesUsageResponse["metricBreakdown"] = {
      messages: {
        metricName: "messages",
        count: totalMessages,
        totalValue: totalMessages,
        avgValue: totalMessages > 0 ? 1 : null,
        maxValue: totalMessages,
        unit: "count",
        earliestRecordedAt: earliestTsMs !== null ? new Date(earliestTsMs).toISOString() : null,
        latestRecordedAt: latestTsMs !== null ? new Date(latestTsMs).toISOString() : null,
      },
      whatsapp: {
        metricName: "whatsapp",
        count: totalMessages,
        totalValue: totalMessages,
        avgValue: totalMessages > 0 ? 1 : null,
        maxValue: totalMessages,
        unit: "count",
        earliestRecordedAt: earliestTsMs !== null ? new Date(earliestTsMs).toISOString() : null,
        latestRecordedAt: latestTsMs !== null ? new Date(latestTsMs).toISOString() : null,
      },
      inbound_messages: {
        metricName: "inbound_messages",
        count: inboundCount,
        totalValue: inboundCount,
        avgValue: null,
        maxValue: inboundCount,
        unit: "count",
        earliestRecordedAt: earliestTsMs !== null ? new Date(earliestTsMs).toISOString() : null,
        latestRecordedAt: latestTsMs !== null ? new Date(latestTsMs).toISOString() : null,
      },
      outbound_messages: {
        metricName: "outbound_messages",
        count: outboundCount,
        totalValue: outboundCount,
        avgValue: null,
        maxValue: outboundCount,
        unit: "count",
        earliestRecordedAt: earliestTsMs !== null ? new Date(earliestTsMs).toISOString() : null,
        latestRecordedAt: latestTsMs !== null ? new Date(latestTsMs).toISOString() : null,
      },
    };

    const usageMetrics = [
      {
        id: `dynamo-messages-${customerId || "platform"}`,
        customer_id: customerId || "platform",
        metric_name: "messages",
        metric_value: totalMessages,
        metric_unit: "count",
        recorded_at: queriedAt,
        created_at: queriedAt,
      },
      {
        id: `dynamo-whatsapp-${customerId || "platform"}`,
        customer_id: customerId || "platform",
        metric_name: "whatsapp",
        metric_value: totalMessages,
        metric_unit: "count",
        recorded_at: queriedAt,
        created_at: queriedAt,
      },
    ];

    const responsePayload: GetDynamoMessagesUsageResponse = {
      success: true,
      source: "dynamodb_messages",
      table: tableName,
      queryMode,
      indexUsed,
      scope,
      customerId,
      matchedIdentifier: customerId || undefined,
      queriedAt,
      count: totalMessages,
      usageMetrics,
      metricBreakdown,
      metrics,
      warning,
    };

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(responsePayload),
    };
  } catch (error: any) {
    console.error("Error executing getDynamoMessagesUsageHandler:", error);

    const emptyMetrics: DynamoMessageMetrics = {
      totalMessages: 0,
      inboundMessages: 0,
      outboundMessages: 0,
      mediaMessages: 0,
      directionBreakdown: { inbound: 0, outbound: 0, other: 0 },
      statusBreakdown: {},
      typeBreakdown: {},
      firstMessageAt: null,
      lastMessageAt: null,
      firstMessageTimestamp: null,
      lastMessageTimestamp: null,
      dailyBreakdown: [],
      recentMessages: [],
      planAllowance: null,
      quotaRemaining: null,
      conversationsCount: null,
      broadcastsCount: null,
      costEstimate: null,
      note: "Query against AWS DynamoDB Messages table failed.",
    };

    const errorResponse: GetDynamoMessagesUsageResponse = {
      success: false,
      source: "dynamodb_messages",
      table: tableName,
      queryMode: "scan_filter",
      indexUsed: null,
      scope,
      customerId,
      queriedAt,
      count: 0,
      usageMetrics: [],
      metricBreakdown: {},
      metrics: emptyMetrics,
      error: error?.message || "Failed to retrieve WhatsApp message usage from DynamoDB Messages",
    };

    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify(errorResponse),
    };
  }
}
