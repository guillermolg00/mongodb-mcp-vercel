import { createMcpHandler } from "mcp-handler";

import { findSchema, findTool } from "@/lib/mongodb/tools/find";
import { aggregateSchema, aggregateTool } from "@/lib/mongodb/tools/aggregate";
import { countSchema, countTool } from "@/lib/mongodb/tools/count";
import {
  listCollectionsSchema,
  listCollectionsTool,
} from "@/lib/mongodb/tools/listCollections";
import { explainSchema, explainTool } from "@/lib/mongodb/tools/explain";
import {
  collectionSchemaSchema,
  collectionSchemaTool,
} from "@/lib/mongodb/tools/collectionSchema";

// Force Node.js runtime (not Edge) for MongoDB driver compatibility
export const runtime = "nodejs";

// Disable response caching for dynamic data
export const dynamic = "force-dynamic";

// Max duration for serverless function
export const maxDuration = 60;

/**
 * Validate API key from request headers.
 * Returns 401 response if validation fails, null if successful.
 */
function validateApiKey(request: Request): Response | null {
  const apiKey = request.headers.get("X-API-Key");
  const expectedKey = process.env.API_KEY;

  if (!expectedKey) {
    return new Response(
      JSON.stringify({
        error: "API_KEY environment variable is not configured",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing X-API-Key header" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (apiKey !== expectedKey) {
    return new Response(JSON.stringify({ error: "Invalid API key" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}

const mcpHandler = createMcpHandler(
  async (server) => {
    // Find documents
    server.registerTool(
      "find",
      {
        title: "Find Documents",
        description:
          "Query documents from a MongoDB collection with optional filtering, projection, sorting, and limiting",
        inputSchema: findSchema,
      },
      findTool
    );

    // Aggregate
    server.registerTool(
      "aggregate",
      {
        title: "Aggregate",
        description:
          "Run an aggregation pipeline on a MongoDB collection for data transformation and analysis",
        inputSchema: aggregateSchema,
      },
      aggregateTool
    );

    // Count
    server.registerTool(
      "count",
      {
        title: "Count Documents",
        description:
          "Count documents in a MongoDB collection, optionally filtered by query",
        inputSchema: countSchema,
      },
      countTool
    );

    // List collections
    server.registerTool(
      "list-collections",
      {
        title: "List Collections",
        description: "List all user collections in the configured database",
        inputSchema: listCollectionsSchema,
      },
      listCollectionsTool
    );

    // Explain
    server.registerTool(
      "explain",
      {
        title: "Explain Query",
        description:
          "Get the execution plan for a find or aggregate operation to analyze query performance",
        inputSchema: explainSchema,
      },
      explainTool
    );

    // Collection schema
    server.registerTool(
      "collection-schema",
      {
        title: "Collection Schema",
        description:
          "Infer the schema of a collection by sampling documents and analyzing field types and presence",
        inputSchema: collectionSchemaSchema,
      },
      collectionSchemaTool
    );
  },
  {},
  {
    basePath: "",
    verboseLogs: true,
    maxDuration: 60,
    disableSse: true,
  }
);

/**
 * Wrap handler with API key authentication.
 */
async function handler(request: Request): Promise<Response> {
  const authError = validateApiKey(request);
  if (authError) {
    return authError;
  }

  return mcpHandler(request);
}

export { handler as GET, handler as POST, handler as DELETE };
