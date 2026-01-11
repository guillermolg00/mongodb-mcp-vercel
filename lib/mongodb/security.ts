/**
 * Security limits and validation for MongoDB operations.
 */

export const SECURITY_LIMITS = {
  maxTimeMS: 30_000,
  maxLimit: 100,
  defaultLimit: 10,
  maxSampleSize: 1000,
  defaultSampleSize: 100,
} as const;

/**
 * Operators that are prohibited in find filters due to security risks.
 * - $where: allows arbitrary JavaScript execution
 * - $function: allows arbitrary JavaScript execution
 * - $accumulator: allows arbitrary JavaScript execution
 */
const PROHIBITED_FILTER_OPERATORS = ["$where", "$function", "$accumulator"];

/**
 * Stages that are prohibited in aggregation pipelines.
 * - $out, $merge: write operations
 * - $function, $accumulator: arbitrary code execution
 * - $lookup with pipeline: potential for internal SSRF
 */
const PROHIBITED_STAGES = ["$out", "$merge", "$function", "$accumulator"];

/**
 * Recursively check if an object contains any prohibited operators.
 */
function containsProhibitedOperator(
  obj: unknown,
  prohibited: string[]
): string | null {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (typeof obj !== "object") {
    return null;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = containsProhibitedOperator(item, prohibited);
      if (found) return found;
    }
    return null;
  }

  for (const [key, value] of Object.entries(obj)) {
    if (prohibited.includes(key)) {
      return key;
    }
    const found = containsProhibitedOperator(value, prohibited);
    if (found) return found;
  }

  return null;
}

/**
 * Validate a find filter for prohibited operators.
 * Throws an error if a prohibited operator is found.
 */
export function validateFilter(filter: Record<string, unknown>): void {
  const prohibited = containsProhibitedOperator(
    filter,
    PROHIBITED_FILTER_OPERATORS
  );

  if (prohibited) {
    throw new Error(
      `Prohibited operator "${prohibited}" found in filter. ` +
        `The following operators are not allowed: ${PROHIBITED_FILTER_OPERATORS.join(", ")}`
    );
  }
}

/**
 * Validate an aggregation pipeline for prohibited stages.
 * Throws an error if a prohibited stage is found.
 */
export function validatePipeline(pipeline: Record<string, unknown>[]): void {
  for (const stage of pipeline) {
    const stageKeys = Object.keys(stage);

    for (const key of stageKeys) {
      if (PROHIBITED_STAGES.includes(key)) {
        throw new Error(
          `Prohibited stage "${key}" found in pipeline. ` +
            `The following stages are not allowed: ${PROHIBITED_STAGES.join(", ")}`
        );
      }
    }

    // Check for $lookup with pipeline (potential SSRF)
    if ("$lookup" in stage) {
      const lookup = stage["$lookup"] as Record<string, unknown>;
      if (lookup && "pipeline" in lookup) {
        throw new Error(
          `$lookup with pipeline is not allowed for security reasons. ` +
            `Use $lookup with localField/foreignField instead.`
        );
      }
    }

    // Recursively check stage content for prohibited operators
    const prohibited = containsProhibitedOperator(stage, [
      "$function",
      "$accumulator",
    ]);
    if (prohibited) {
      throw new Error(
        `Prohibited operator "${prohibited}" found in pipeline stage. ` +
          `Code execution operators are not allowed.`
      );
    }
  }
}

/**
 * Apply security limits to a limit value.
 * Returns the effective limit, capped at maxLimit.
 */
export function applyLimit(requestedLimit?: number): number {
  if (requestedLimit === undefined || requestedLimit === null) {
    return SECURITY_LIMITS.defaultLimit;
  }

  if (requestedLimit <= 0) {
    return SECURITY_LIMITS.defaultLimit;
  }

  return Math.min(requestedLimit, SECURITY_LIMITS.maxLimit);
}

/**
 * Apply security limits to a sample size value.
 */
export function applySampleSize(requestedSize?: number): number {
  if (requestedSize === undefined || requestedSize === null) {
    return SECURITY_LIMITS.defaultSampleSize;
  }

  if (requestedSize <= 0) {
    return SECURITY_LIMITS.defaultSampleSize;
  }

  return Math.min(requestedSize, SECURITY_LIMITS.maxSampleSize);
}
