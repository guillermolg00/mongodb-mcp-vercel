import { z } from "zod";
import type { SortDirection } from "mongodb";
import { getDatabase, getDatabaseName } from "../client";
import { validateFilter, applyLimit, SECURITY_LIMITS } from "../security";
import { formatDocuments } from "../serializer";

export const findSchema = z.object({
  collection: z.string().min(1).describe("Collection name"),
  filter: z
    .record(z.unknown())
    .optional()
    .default({})
    .describe(
      "Query filter matching MongoDB query syntax. Example: { status: 'active' }"
    ),
  projection: z
    .record(z.union([z.number(), z.boolean()]))
    .optional()
    .describe("Fields to include/exclude. Example: { name: 1, _id: 0 }"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(SECURITY_LIMITS.maxLimit)
    .optional()
    .default(SECURITY_LIMITS.defaultLimit)
    .describe(
      `Max documents to return (1-${SECURITY_LIMITS.maxLimit}, default: ${SECURITY_LIMITS.defaultLimit})`
    ),
  sort: z
    .record(z.union([z.literal(1), z.literal(-1)]))
    .optional()
    .describe("Sort order. Example: { createdAt: -1 } for descending"),
});

export type FindArgs = z.infer<typeof findSchema>;

export async function findTool(args: FindArgs) {
  const { collection, filter, projection, limit, sort } = args;

  // Validate filter for prohibited operators
  validateFilter(filter);

  const db = await getDatabase();
  const dbName = getDatabaseName();

  const effectiveLimit = applyLimit(limit);

  const cursor = db.collection(collection).find(filter, {
    projection,
    sort: sort as Record<string, SortDirection>,
    limit: effectiveLimit,
    maxTimeMS: SECURITY_LIMITS.maxTimeMS,
  });

  const documents = await cursor.toArray();

  const message =
    documents.length === 0
      ? `No documents found in "${dbName}.${collection}"`
      : `Found ${documents.length} document${
          documents.length === 1 ? "" : "s"
        } in "${dbName}.${collection}"` +
        (documents.length === effectiveLimit
          ? ` (limited to ${effectiveLimit})`
          : "");

  return {
    content: formatDocuments(message, documents),
  };
}
