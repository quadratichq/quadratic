export type StringId = `${string},${string}`;

export function getKey(x?: number, y?: number): StringId {
  return `${x ?? ''},${y ?? ''}`;
}
