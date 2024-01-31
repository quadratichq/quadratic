// Type definitions
type JsonPrimitive = string | number | boolean | null;
type JsonArray = Array<JsonValue>;
interface JsonObject {
  [key: string]: JsonValue;
}
type JsonValue = JsonPrimitive | JsonObject | JsonArray;

// Type guard to check if a value is a JsonObject
export function isJsonObject(value: any): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
