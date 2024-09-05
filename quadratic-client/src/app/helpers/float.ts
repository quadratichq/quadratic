export function isFloatEqual(a: number, b: number, epsilon = 0.001): boolean {
  return Math.abs(a - b) < epsilon;
}

export function isFloatLessThan(a: number, b: number, epsilon = 0.001): boolean {
  return a < b - epsilon;
}

export function isFloatGreaterThan(a: number, b: number, epsilon = 0.001): boolean {
  return a > b + epsilon;
}
