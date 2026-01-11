import { z } from "zod";
import { getDatabase, getDatabaseName } from "../client";
import { validatePipeline, applyLimit, SECURITY_LIMITS } from "../security";
import { formatDocuments } from "../serializer";

export const aggregateSchema = z.object({
  collection: z.string().min(1).describe("Collection name"),
  pipeline: z
    .array(z.record(z.unknown()))
    .min(1)
    .describe(
      "Aggregation pipeline stages. Example: [{ $match: { status: 'active' } }, { $group: { _id: '$category', count: { $sum: 1 } } }]"
    ),
});

export type AggregateArgs = z.infer<typeof aggregateSchema>;

/**
 * Check if pipeline already has a $limit stage.
 */
function hasLimitStage(pipeline: Record<string, unknown>[]): boolean {
  return pipeline.some((stage) => "$limit" in stage);
}

export async function aggregateTool(args: AggregateArgs) {
  const { collection, pipeline } = args;

  // Validate pipeline for prohibited stages
  validatePipeline(pipeline);

  const db = await getDatabase();
  const dbName = getDatabaseName();

  // Add $limit if not present to prevent unbounded results
  const effectivePipeline = [...pipeline];
  if (!hasLimitStage(effectivePipeline)) {
    effectivePipeline.push({ $limit: applyLimit(SECURITY_LIMITS.maxLimit) });
  }

  const cursor = db.collection(collection).aggregate(effectivePipeline, {
    maxTimeMS: SECURITY_LIMITS.maxTimeMS,
  });

  const documents = await cursor.toArray();

  const message =
    documents.length === 0
      ? `Aggregation on "${dbName}.${collection}" returned no results`
      : `Aggregation on "${dbName}.${collection}" returned ${
          documents.length
        } document${documents.length === 1 ? "" : "s"}`;

  return {
    content: formatDocuments(message, documents),
  };
}
