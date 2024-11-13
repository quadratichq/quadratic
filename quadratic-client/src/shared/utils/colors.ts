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
