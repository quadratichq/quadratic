import Color from 'color';

export function getCSSVariableAsHexColor(cssVariableName: string) {
  if (cssVariableName.startsWith('--')) {
    console.warn(
      '`getCSSVariableTint` expects a CSS variable name without the `--` prefix. Are you sure you meant: `%s`',
      cssVariableName
    );
  }

  const hslColorString = getComputedStyle(document.documentElement).getPropertyValue(`--${cssVariableName}`).trim();
  const parsed = Color.hsl(hslColorString.split(' ').map(parseFloat));
  const out = parsed.hex();
  return out;
}

/**
 * Get a color that transitions smoothly from gray to yellow to red based on percentage.
 * Used for context usage indicators and similar progress visualizations.
 *
 * Color stops:
 * - 0-25%: Gray (muted)
 * - 25-50%: Transitions from gray to yellow/amber
 * - 50-75%: Transitions from yellow/amber to red
 * - 75%+: Pure red
 *
 * @param percentage - A value from 0 to 100
 * @returns RGB color string
 */
export function getPercentageGradientColor(percentage: number): string {
  // Define color stops: muted (gray) -> warning (yellow/orange) -> destructive (red)
  // Muted: ~156, 163, 175 (gray)
  // Warning: ~234, 179, 8 (amber/yellow)
  // Destructive: ~239, 68, 68 (red)

  if (percentage <= 25) {
    // Pure muted gray
    return 'rgb(156, 163, 175)';
  } else if (percentage <= 50) {
    // Interpolate from muted to warning (25% to 50%)
    const t = (percentage - 25) / 25;
    const r = Math.round(156 + t * (234 - 156));
    const g = Math.round(163 + t * (179 - 163));
    const b = Math.round(175 + t * (8 - 175));
    return `rgb(${r}, ${g}, ${b})`;
  } else if (percentage <= 75) {
    // Interpolate from warning to destructive (50% to 75%)
    const t = (percentage - 50) / 25;
    const r = Math.round(234 + t * (239 - 234));
    const g = Math.round(179 + t * (68 - 179));
    const b = Math.round(8 + t * (68 - 8));
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Pure destructive red
    return 'rgb(239, 68, 68)';
  }
}
