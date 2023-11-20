// calculates the fade alpha for grid when zooming out
export function calculateAlphaForGridLines(scale: number): number {
  if (scale < 0.1) {
    return 0;
  } else if (scale < 0.3) {
    return scale * 3 - 0.3;
  } else {
    return 1;
  }
}
