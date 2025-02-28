import { debugShowFileIO } from '@/app/debugFlags';
import FontFaceObserver from 'fontfaceobserver';
import { BitmapFont, Loader } from 'pixi.js';
import { createBorderTypes } from './generateTextures';

const intervalToCheckBitmapFonts = 100;
export const bitmapFonts = ['OpenSans', 'OpenSans-Bold', 'OpenSans-Italic', 'OpenSans-BoldItalic'];

function loadFont(fontName: string): void {
  const font = new FontFaceObserver(fontName);
  font.load();
}

export function ensureBitmapFontLoaded(resolve: () => void): void {
  const waitForLoad = () => {
    if (bitmapFonts.find((font) => !BitmapFont.available[font])) {
      setTimeout(waitForLoad, intervalToCheckBitmapFonts);
    } else {
      if (debugShowFileIO) console.log('[pixiApp] assets loaded.');
      resolve();
    }
  };

  waitForLoad();
}

export function loadAssets(): Promise<void> {
  return new Promise((resolve) => {
    if (debugShowFileIO) console.log('[pixiApp] Loading assets...');
    createBorderTypes();

    // Load HTML fonts for Input
    loadFont('OpenSans');
    loadFont('OpenSans-Bold');
    loadFont('OpenSans-Italic');
    loadFont('OpenSans-BoldItalic');

    // Load PixiJS fonts for canvas
    addResourceOnce('OpenSans', '/fonts/opensans/OpenSans.fnt');
    addResourceOnce('OpenSans-Bold', '/fonts/opensans/OpenSans-Bold.fnt');
    addResourceOnce('OpenSans-Italic', '/fonts/opensans/OpenSans-Italic.fnt');
    addResourceOnce('OpenSans-BoldItalic', '/fonts/opensans/OpenSans-BoldItalic.fnt');

    // CellsMarker
    addResourceOnce('icon-formula', '/images/icon-formula.png');
    addResourceOnce('icon-python', '/images/icon-python.png');
    addResourceOnce('icon-javascript', '/images/icon-javascript.png');
    addResourceOnce('icon-postgres', '/images/icon-postgres.png');
    addResourceOnce('icon-mysql', '/images/icon-mysql.png');
    addResourceOnce('icon-snowflake', '/images/icon-snowflake.png');
    addResourceOnce('icon-mssql', '/images/icon-mssql.png');
    addResourceOnce('checkbox-icon', '/images/checkbox.png');
    addResourceOnce('checkbox-checked-icon', '/images/checkbox-checked.png');
    addResourceOnce('dropdown-icon', '/images/dropdown.png');
    addResourceOnce('dropdown-white-icon', '/images/dropdown-white.png');

    addResourceOnce('sort-ascending', '/images/sort-ascending.svg');
    addResourceOnce('sort-descending', '/images/sort-descending.svg');

    // Wait until pixi fonts are loaded before resolving
    Loader.shared.load(() => {
      ensureBitmapFontLoaded(resolve);
    });
  });
}

function addResourceOnce(name: string, url: string) {
  if (!Loader.shared.resources[name]) {
    Loader.shared.add(name, url);
  }
}
