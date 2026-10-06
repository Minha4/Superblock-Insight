import { getBroadcastUsageHandler } from "./usageMetrics/getBroadcastUsage";

async function runTest() {
  console.log("=== Testing PostgreSQL Broadcast Usage Lambda Handler ===");
  console.log("Table: public.broadcasts");
  console.log("");

  // Test 1: Customer-specific query
  console.log("--- Test 1: Invocation with customerId = 'cust_123' ---");
  const eventCustomer = {
    httpMethod: "GET",
    path: "/usage-metrics/broadcasts",
    queryStringParameters: {
      customerId: "cust_123",
      limit: "50",
    },
  };

  const resCustomer = await getBroadcastUsageHandler(eventCustomer);
  console.log(`HTTP Status Code: ${resCustomer.statusCode}`);
  const bodyCustomer = JSON.parse(resCustomer.body);
  console.log("Response Summary:", {
    success: bodyCustomer.success,
    source: bodyCustomer.source,
    table: bodyCustomer.table,
    scope: bodyCustomer.scope,
    customerId: bodyCustomer.customerId,
    count: bodyCustomer.count,
    totalBroadcasts: bodyCustomer.totalBroadcasts,
    totalRecipients: bodyCustomer.totalRecipients,
    hasFlowCount: bodyCustomer.metrics?.hasFlowCount,
    statusBreakdown: bodyCustomer.metrics?.statusBreakdown,
    recentBroadcastsCount: bodyCustomer.metrics?.recentBroadcasts?.length,
    metricBreakdownBroadcasts: bodyCustomer.metricBreakdown?.broadcasts,
    error: bodyCustomer.error,
  });
  console.log("");

  // Test 2: Platform-wide query (no customerId)
  console.log("--- Test 2: Invocation without customerId (platform scope) ---");
  const eventPlatform = {
    httpMethod: "GET",
    path: "/broadcast-usage",
    queryStringParameters: {
      limit: "20",
    },
  };

  const resPlatform = await getBroadcastUsageHandler(eventPlatform);
  console.log(`HTTP Status Code: ${resPlatform.statusCode}`);
  const bodyPlatform = JSON.parse(resPlatform.body);
  console.log("Response Summary:", {
    success: bodyPlatform.success,
    source: bodyPlatform.source,
    table: bodyPlatform.table,
    scope: bodyPlatform.scope,
    count: bodyPlatform.count,
    totalBroadcasts: bodyPlatform.totalBroadcasts,
    totalRecipients: bodyPlatform.totalRecipients,
    statusBreakdown: bodyPlatform.metrics?.statusBreakdown,
    mediaTypeBreakdown: bodyPlatform.metrics?.mediaTypeBreakdown,
    error: bodyPlatform.error,
  });
  console.log("");

  // Test 3: OPTIONS preflight check
  console.log("--- Test 3: OPTIONS preflight check ---");
  const eventOptions = {
    httpMethod: "OPTIONS",
    path: "/broadcast-usage",
  };
  const resOptions = await getBroadcastUsageHandler(eventOptions);
  console.log(`OPTIONS Status Code: ${resOptions.statusCode}`);
  console.log("OPTIONS Headers:", resOptions.headers);
  console.log("");

  console.log("=== Broadcasts Lambda Handler Test Completed ===");
}

runTest().catch((err) => {
  console.error("Test execution failed:", err);
});
