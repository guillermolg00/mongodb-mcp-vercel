import { z } from "zod";
import { getDatabase, getDatabaseName } from "../client";
import { validateFilter, SECURITY_LIMITS } from "../security";
import { textContent } from "../serializer";

export const countSchema = z.object({
  collection: z.string().min(1).describe("Collection name"),
  filter: z
    .record(z.unknown())
    .optional()
    .default({})
    .describe(
      "Query filter to count matching documents. Example: { status: 'active' }"
    ),
});

export type CountArgs = z.infer<typeof countSchema>;

export async function countTool(args: CountArgs) {
  const { collection, filter } = args;

  // Validate filter for prohibited operators
  validateFilter(filter);

  const db = await getDatabase();
  const dbName = getDatabaseName();

  const count = await db.collection(collection).countDocuments(filter, {
    maxTimeMS: SECURITY_LIMITS.maxTimeMS,
  });

  const filterDesc =
    Object.keys(filter).length > 0 ? " matching the filter" : "";

  return {
    content: [
      textContent(
        `Found ${count.toLocaleString()} document${count === 1 ? "" : "s"}${filterDesc} in "${dbName}.${collection}"`
      ),
    ],
  };
}
