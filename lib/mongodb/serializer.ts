import { EJSON, type Document } from "bson";

/**
 * Serialize MongoDB documents to EJSON string.
 * Uses relaxed mode for better readability while preserving types.
 */
export function serialize(docs: Document | Document[]): string {
  return EJSON.stringify(docs, { relaxed: true }, 2);
}

/**
 * Create a text content item for MCP response.
 */
export function textContent(text: string) {
  return { type: "text" as const, text };
}

/**
 * Format documents for MCP tool response.
 */
export function formatDocuments(
  message: string,
  docs: Document[]
): { type: "text"; text: string }[] {
  const content: { type: "text"; text: string }[] = [textContent(message)];

  if (docs.length > 0) {
    content.push(textContent(serialize(docs)));
  }

  return content;
}
