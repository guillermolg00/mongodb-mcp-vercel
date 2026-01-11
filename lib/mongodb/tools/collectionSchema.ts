import { z } from "zod";
import { ObjectId, type Document } from "bson";
import { getDatabase, getDatabaseName } from "../client";
import { applySampleSize, SECURITY_LIMITS } from "../security";
import { textContent } from "../serializer";

export const collectionSchemaSchema = z.object({
  collection: z.string().min(1).describe("Collection name"),
  sampleSize: z
    .number()
    .int()
    .min(1)
    .max(SECURITY_LIMITS.maxSampleSize)
    .optional()
    .default(SECURITY_LIMITS.defaultSampleSize)
    .describe(
      `Number of documents to sample for schema inference (1-${SECURITY_LIMITS.maxSampleSize}, default: ${SECURITY_LIMITS.defaultSampleSize})`
    ),
});

export type CollectionSchemaArgs = z.infer<typeof collectionSchemaSchema>;

interface FieldSchema {
  types: string[];
  percentage: number;
}

type SchemaResult = Record<string, FieldSchema>;

/**
 * Get the BSON type name for a value.
 */
function getBsonType(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  if (value instanceof ObjectId) return "ObjectId";
  if (value instanceof Date) return "Date";
  if (value instanceof RegExp) return "RegExp";
  if (ArrayBuffer.isView(value)) return "Binary";

  if (Array.isArray(value)) return "Array";

  const type = typeof value;
  if (type === "object") return "Object";
  if (type === "number") {
    return Number.isInteger(value) ? "Int" : "Double";
  }
  if (type === "boolean") return "Boolean";
  if (type === "string") return "String";
  if (type === "bigint") return "Long";

  return "Unknown";
}

/**
 * Recursively extract field paths and their types from a document.
 */
function extractFields(
  doc: Document,
  prefix: string = ""
): Map<string, string> {
  const fields = new Map<string, string>();

  for (const [key, value] of Object.entries(doc)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    const type = getBsonType(value);
    fields.set(fieldPath, type);

    // For nested objects, extract nested fields (but not for arrays)
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof ObjectId) &&
      !(value instanceof Date) &&
      !(value instanceof RegExp)
    ) {
      const nestedFields = extractFields(value as Document, fieldPath);
      for (const [nestedPath, nestedType] of nestedFields) {
        fields.set(nestedPath, nestedType);
      }
    }
  }

  return fields;
}

/**
 * Infer schema from sampled documents.
 */
function inferSchema(documents: Document[]): SchemaResult {
  if (documents.length === 0) {
    return {};
  }

  const totalDocs = documents.length;
  const fieldStats: Map<string, Map<string, number>> = new Map();

  // Collect type counts for each field
  for (const doc of documents) {
    const fields = extractFields(doc);

    for (const [fieldPath, type] of fields) {
      if (!fieldStats.has(fieldPath)) {
        fieldStats.set(fieldPath, new Map());
      }

      const typeCounts = fieldStats.get(fieldPath)!;
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    }
  }

  // Build schema result with percentages
  const schema: SchemaResult = {};

  for (const [fieldPath, typeCounts] of fieldStats) {
    const types = Array.from(typeCounts.keys()).sort();
    const totalOccurrences = Array.from(typeCounts.values()).reduce(
      (a, b) => a + b,
      0
    );
    const percentage = Math.round((totalOccurrences / totalDocs) * 100);

    schema[fieldPath] = { types, percentage };
  }

  return schema;
}

/**
 * Format schema for display.
 */
function formatSchema(schema: SchemaResult): string {
  const lines: string[] = [];

  // Sort fields: top-level first, then nested
  const sortedFields = Object.keys(schema).sort((a, b) => {
    const aDepth = a.split(".").length;
    const bDepth = b.split(".").length;
    if (aDepth !== bDepth) return aDepth - bDepth;
    return a.localeCompare(b);
  });

  for (const field of sortedFields) {
    const { types, percentage } = schema[field];
    const indent = "  ".repeat(field.split(".").length - 1);
    const fieldName = field.includes(".") ? field.split(".").pop() : field;
    lines.push(`${indent}${fieldName}: ${types.join(" | ")} (${percentage}%)`);
  }

  return lines.join("\n");
}

export async function collectionSchemaTool(args: CollectionSchemaArgs) {
  const { collection, sampleSize } = args;

  const db = await getDatabase();
  const dbName = getDatabaseName();

  const effectiveSampleSize = applySampleSize(sampleSize);

  const pipeline = [{ $sample: { size: effectiveSampleSize } }];

  const documents = await db
    .collection(collection)
    .aggregate(pipeline, {
      maxTimeMS: SECURITY_LIMITS.maxTimeMS,
    })
    .toArray();

  if (documents.length === 0) {
    return {
      content: [
        textContent(
          `Collection "${dbName}.${collection}" is empty or does not exist`
        ),
      ],
    };
  }

  const schema = inferSchema(documents);
  const fieldCount = Object.keys(schema).length;
  const formattedSchema = formatSchema(schema);

  return {
    content: [
      textContent(
        `Schema for "${dbName}.${collection}" (sampled ${
          documents.length
        } document${documents.length === 1 ? "" : "s"}, ${fieldCount} field${
          fieldCount === 1 ? "" : "s"
        }):\n\n${formattedSchema}`
      ),
    ],
  };
}
