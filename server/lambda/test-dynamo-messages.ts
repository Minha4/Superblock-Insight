import { getDynamoMessagesUsageHandler } from "./usageMetrics/getDynamoMessagesUsage";
import { getMessagesTableName, getMessagesIndexName, getMessagesIndexKey } from "./dynamodb";

async function runTest() {
  console.log("=== Testing DynamoDB Messages Lambda Handler ===");
  console.log(`Table Name: ${getMessagesTableName()}`);
  console.log(`Configured GSI: ${getMessagesIndexName() || "(None - using FilterExpression scan)"}`);
  console.log(`Configured Index Key: ${getMessagesIndexKey()}`);
  console.log("");

  // Test 1: Customer-specific query
  console.log("--- Test 1: Invocation with customerId = '6790a880ffc7e99762cb0248' ---");
  const eventCustomer = {
    httpMethod: "GET",
    path: "/usage-metrics/messages",
    queryStringParameters: {
      customerId: "6790a880ffc7e99762cb0248",
      limit: "100",
    },
  };

  const resCustomer = await getDynamoMessagesUsageHandler(eventCustomer);
  console.log(`HTTP Status Code: ${resCustomer.statusCode}`);
  const bodyCustomer = JSON.parse(resCustomer.body);
  console.log("Response Summary:", {
    success: bodyCustomer.success,
    source: bodyCustomer.source,
    table: bodyCustomer.table,
    queryMode: bodyCustomer.queryMode,
    indexUsed: bodyCustomer.indexUsed,
    scope: bodyCustomer.scope,
    customerId: bodyCustomer.customerId,
    totalMessages: bodyCustomer.metrics?.totalMessages,
    inboundMessages: bodyCustomer.metrics?.inboundMessages,
    outboundMessages: bodyCustomer.metrics?.outboundMessages,
    mediaMessages: bodyCustomer.metrics?.mediaMessages,
    planAllowance: bodyCustomer.metrics?.planAllowance,
    note: bodyCustomer.metrics?.note,
    warning: bodyCustomer.warning,
    error: bodyCustomer.error,
  });
  console.log("");

  // Test 2: Platform-wide query (no customerId)
  console.log("--- Test 2: Invocation without customerId (platform scope) ---");
  const eventPlatform = {
    httpMethod: "GET",
    path: "/usage-metrics/messages",
    queryStringParameters: {
      limit: "50",
    },
  };

  const resPlatform = await getDynamoMessagesUsageHandler(eventPlatform);
  console.log(`HTTP Status Code: ${resPlatform.statusCode}`);
  const bodyPlatform = JSON.parse(resPlatform.body);
  console.log("Response Summary:", {
    success: bodyPlatform.success,
    source: bodyPlatform.source,
    table: bodyPlatform.table,
    queryMode: bodyPlatform.queryMode,
    scope: bodyPlatform.scope,
    totalMessages: bodyPlatform.metrics?.totalMessages,
    warning: bodyPlatform.warning,
    error: bodyPlatform.error,
  });
  console.log("");
  console.log("=== DynamoDB Messages Lambda Test Complete ===");
}

runTest().catch((err) => {
  console.error("Test failed with uncaught error:", err);
});
