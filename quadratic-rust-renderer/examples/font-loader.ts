/**
 * BMFont XML Parser and Loader
 *
 * Parses .fnt files (BMFont XML format) and converts them to our
 * Rust renderer's BitmapFont JSON format.
 */

export interface CharData {
  texture_uid: number;
  x_advance: number;
  x_offset: number;
  y_offset: number;
  orig_width: number;
  texture_height: number;
  kerning: Record<number, number>;
  uvs: number[];
  frame: { x: number; y: number; width: number; height: number };
}

export interface FontData {
  font: string;
  size: number;
  line_height: number;
  distance_range: number;
  chars: Record<number, CharData>;
  pages: string[];
  scaleW: number;
  scaleH: number;
}

/**
 * Parse a BMFont XML file and return a BitmapFont JSON object
 */
export async function parseBMFont(fntUrl: string): Promise<FontData> {
  const response = await fetch(fntUrl);
  const xmlText = await response.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  const info = doc.querySelector('info');
  const common = doc.querySelector('common');
  const pages = doc.querySelectorAll('page');
  const chars = doc.querySelectorAll('char');
  const distanceField = doc.querySelector('distanceField');

  if (!info || !common) {
    throw new Error('Invalid BMFont XML: missing info or common elements');
  }

  const fontName = info.getAttribute('face') ?? 'Unknown';
  const fontSize = parseFloat(info.getAttribute('size') ?? '14');
  const lineHeight = parseFloat(common.getAttribute('lineHeight') ?? '20');
  const scaleW = parseFloat(common.getAttribute('scaleW') ?? '256');
  const scaleH = parseFloat(common.getAttribute('scaleH') ?? '256');

  // MSDF distance field range (critical for anti-aliasing)
  const distanceRange = distanceField
    ? parseFloat(distanceField.getAttribute('distanceRange') ?? '4')
    : 4;

  // Parse pages (texture files)
  const pageFiles: string[] = [];
  pages.forEach((page) => {
    const id = parseInt(page.getAttribute('id') ?? '0');
    let file = page.getAttribute('file') ?? '';
    // Remove version query string if present
    file = file.split('?')[0];
    pageFiles[id] = file;
  });

  // Parse characters
  const charsMap: Record<number, CharData> = {};
  chars.forEach((char) => {
    const id = parseInt(char.getAttribute('id') ?? '0');
    const x = parseFloat(char.getAttribute('x') ?? '0');
    const y = parseFloat(char.getAttribute('y') ?? '0');
    const width = parseFloat(char.getAttribute('width') ?? '0');
    const height = parseFloat(char.getAttribute('height') ?? '0');
    const xoffset = parseFloat(char.getAttribute('xoffset') ?? '0');
    const yoffset = parseFloat(char.getAttribute('yoffset') ?? '0');
    const xadvance = parseFloat(char.getAttribute('xadvance') ?? '0');
    const page = parseInt(char.getAttribute('page') ?? '0');

    // Calculate UV coordinates (normalized 0-1)
    const u0 = x / scaleW;
    const v0 = y / scaleH;
    const u1 = (x + width) / scaleW;
    const v1 = (y + height) / scaleH;

    charsMap[id] = {
      texture_uid: page, // Use page number as texture UID
      x_advance: xadvance,
      x_offset: xoffset,
      y_offset: yoffset,
      orig_width: width,
      texture_height: height,
      kerning: {}, // TODO: Parse kerning pairs
      // UV coordinates for the 4 corners [u0,v0, u1,v0, u1,v1, u0,v1]
      uvs: [u0, v0, u1, v0, u1, v1, u0, v1],
      frame: { x, y, width, height },
    };
  });

  // Parse kerning pairs if present
  const kernings = doc.querySelectorAll('kerning');
  kernings.forEach((k) => {
    const first = parseInt(k.getAttribute('first') ?? '0');
    const second = parseInt(k.getAttribute('second') ?? '0');
    const amount = parseFloat(k.getAttribute('amount') ?? '0');
    if (charsMap[second]) {
      charsMap[second].kerning[first] = amount;
    }
  });

  return {
    font: fontName,
    size: fontSize,
    line_height: lineHeight,
    distance_range: distanceRange,
    chars: charsMap,
    pages: pageFiles,
    scaleW,
    scaleH,
  };
}

/**
 * Load font textures and return as Image elements
 */
export async function loadFontTextures(
  fontData: FontData,
  basePath: string
): Promise<HTMLImageElement[]> {
  const textures: HTMLImageElement[] = [];

  for (let i = 0; i < fontData.pages.length; i++) {
    const file = fontData.pages[i];
    if (!file) continue;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = `${basePath}/${file}`;
    });

    textures[i] = img;
  }

  return textures;
}

/**
 * Load a complete font (data + textures)
 */
export async function loadFont(
  fntUrl: string,
  basePath: string
): Promise<{ fontData: FontData; textures: HTMLImageElement[] }> {
  const fontData = await parseBMFont(fntUrl);
  const textures = await loadFontTextures(fontData, basePath);

  return { fontData, textures };
}
