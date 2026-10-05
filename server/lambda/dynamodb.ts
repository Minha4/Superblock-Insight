import fs from "node:fs";
import path from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/**
 * Safely loads environment variables from .env.local or .env into process.env
 * if they are not already populated by the runtime environment.
 */
function loadEnv(): void {
  try {
    const rootDir = process.cwd();
    const candidateFiles = [
      path.resolve(rootDir, ".env.local"),
      path.resolve(rootDir, ".env"),
    ];

    for (const filePath of candidateFiles) {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
        break;
      }
    }
  } catch {
    // Non-blocking in serverless environments
  }
}

let cachedClient: DynamoDBClient | null = null;
let cachedDocClient: DynamoDBDocumentClient | null = null;

/**
 * Returns a cached AWS DynamoDB Client configured for the target AWS region.
 * Uses IAM execution role credentials in AWS Lambda, or standard AWS environment
 * variables / credentials in local development.
 */
export function getDynamoClient(): DynamoDBClient {
  if (!cachedClient) {
    loadEnv();
    const region =
      process.env.AWS_REGION ||
      process.env.VITE_AWS_REGION ||
      process.env.NEXT_PUBLIC_AWS_REGION ||
      "ap-south-1";

    cachedClient = new DynamoDBClient({
      region,
    });
  }
  return cachedClient;
}

/**
 * Returns a cached DynamoDB Document Client with automatic marshaling/unmarshaling.
 */
export function getDynamoDocClient(): DynamoDBDocumentClient {
  if (!cachedDocClient) {
    const client = getDynamoClient();
    cachedDocClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });
  }
  return cachedDocClient;
}

/**
 * Resolves the DynamoDB table name for Messages from environment variables.
 * Defaults to "Messages".
 */
export function getMessagesTableName(): string {
  loadEnv();
  return (
    process.env.DYNAMODB_MESSAGES_TABLE ||
    process.env.MESSAGES_TABLE_NAME ||
    "Messages"
  );
}

/**
 * Resolves the optional Global Secondary Index (GSI) name from environment variables.
 * Returns null if no GSI has been configured.
 */
export function getMessagesIndexName(): string | null {
  loadEnv();
  return (
    process.env.DYNAMODB_MESSAGES_INDEX_NAME ||
    process.env.MESSAGES_GSI_NAME ||
    process.env.MESSAGES_INDEX_NAME ||
    null
  );
}

/**
 * Resolves the partition key attribute name of the GSI.
 * Defaults to "client#user_id" if an index is configured.
 */
export function getMessagesIndexKey(): string {
  loadEnv();
  return (
    process.env.DYNAMODB_MESSAGES_INDEX_KEY ||
    "client#user_id"
  );
}
