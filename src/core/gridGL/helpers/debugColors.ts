const DEBUG_COLORS = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0x00ffff, 0x880000, 0x008800, 0x000088, 0x888800, 0x008888];

let debugColor = 0;

export function debugGetColor(): number {
  const color = DEBUG_COLORS[debugColor];
  debugColor = (debugColor + 1) % DEBUG_COLORS.length;
  return color;
}