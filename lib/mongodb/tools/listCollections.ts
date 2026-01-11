import { z } from "zod";
import { getDatabase, getDatabaseName } from "../client";
import { textContent } from "../serializer";

export const listCollectionsSchema = z.object({});

export type ListCollectionsArgs = z.infer<typeof listCollectionsSchema>;

/**
 * Check if a collection is a system collection.
 */
function isSystemCollection(name: string): boolean {
  return name.startsWith("system.");
}

export async function listCollectionsTool(_args: ListCollectionsArgs) {
  const db = await getDatabase();
  const dbName = getDatabaseName();

  const collections = await db
    .listCollections({}, { nameOnly: true })
    .toArray();

  // Filter out system collections
  const userCollections = collections
    .map((c) => c.name)
    .filter((name) => !isSystemCollection(name))
    .sort();

  if (userCollections.length === 0) {
    return {
      content: [
        textContent(`No collections found in database "${dbName}"`),
      ],
    };
  }

  const collectionList = userCollections
    .map((name) => `  - ${name}`)
    .join("\n");

  return {
    content: [
      textContent(
        `Found ${userCollections.length} collection${userCollections.length === 1 ? "" : "s"} in "${dbName}":\n${collectionList}`
      ),
    ],
  };
}
