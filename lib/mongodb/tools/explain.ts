import { z } from "zod";
import type { SortDirection } from "mongodb";
import { getDatabase, getDatabaseName } from "../client";
import {
  validateFilter,
  validatePipeline,
  SECURITY_LIMITS,
} from "../security";
import { serialize, textContent } from "../serializer";

const findArgsSchema = z.object({
  filter: z.record(z.unknown()).optional().default({}),
  projection: z.record(z.union([z.number(), z.boolean()])).optional(),
  sort: z.record(z.union([z.literal(1), z.literal(-1)])).optional(),
  limit: z.number().int().min(1).optional(),
});

const aggregateArgsSchema = z.object({
  pipeline: z.array(z.record(z.unknown())).min(1),
});

export const explainSchema = z.object({
  collection: z.string().min(1).describe("Collection name"),
  operation: z
    .enum(["find", "aggregate"])
    .describe("Operation type to explain"),
  operationArgs: z
    .union([findArgsSchema, aggregateArgsSchema])
    .describe(
      "Arguments for the operation. For find: { filter?, projection?, sort?, limit? }. For aggregate: { pipeline: [...] }"
    ),
});

export type ExplainArgs = z.infer<typeof explainSchema>;

export async function explainTool(args: ExplainArgs) {
  const { collection, operation, operationArgs } = args;

  const db = await getDatabase();
  const dbName = getDatabaseName();

  let explainResult: unknown;

  if (operation === "find") {
    const findArgs = findArgsSchema.parse(operationArgs);

    // Validate filter for prohibited operators
    validateFilter(findArgs.filter);

    explainResult = await db
      .collection(collection)
      .find(findArgs.filter, {
        projection: findArgs.projection,
        sort: findArgs.sort as Record<string, SortDirection>,
        limit: findArgs.limit,
        maxTimeMS: SECURITY_LIMITS.maxTimeMS,
      })
      .explain("executionStats");
  } else {
    const aggArgs = aggregateArgsSchema.parse(operationArgs);

    // Validate pipeline for prohibited stages
    validatePipeline(aggArgs.pipeline);

    explainResult = await db
      .collection(collection)
      .aggregate(aggArgs.pipeline, {
        maxTimeMS: SECURITY_LIMITS.maxTimeMS,
      })
      .explain("executionStats");
  }

  return {
    content: [
      textContent(
        `Execution plan for ${operation} on "${dbName}.${collection}":`
      ),
      textContent(serialize(explainResult as Record<string, unknown>)),
    ],
  };
}
