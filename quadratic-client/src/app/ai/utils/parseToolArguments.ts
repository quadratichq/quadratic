/**
 * Safely parse tool call arguments for consistent JSON parse error handling
 * when executing or re-executing AI tool calls.
 *
 * The parsed value is intentionally untyped (Record<string, unknown>). The tool
 * name is only known at runtime, so type safety comes from the next step: callers
 * should validate with the appropriate schema (e.g. aiToolsSpec[tool].responseSchema.parse(value)).
 *
 * @param argumentsJson - Raw JSON string from the tool call (or undefined)
 * @returns Either { ok: true, value } with the parsed object, or { ok: false, error }
 */
export function parseToolArguments(
  argumentsJson: string | undefined
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  if (argumentsJson == null || argumentsJson === '') {
    return { ok: true, value: {} };
  }
  try {
    const value = JSON.parse(argumentsJson);
    return { ok: true, value: typeof value === 'object' && value !== null ? value : {} };
  } catch (e) {
    const message = e instanceof SyntaxError ? 'Invalid JSON in tool arguments' : String(e);
    return { ok: false, error: message };
  }
}
