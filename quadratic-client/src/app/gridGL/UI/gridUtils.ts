// calculates the fade alpha for grid when zooming out
export function calculateAlphaForGridLines(scale: number): number {
  return scale < 0.25 ? 0 : scale < 0.6 ? scale * 2 - 0.4 : 1;
}
