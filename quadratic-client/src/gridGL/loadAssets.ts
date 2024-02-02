import FontFaceObserver from 'fontfaceobserver';
import { BitmapFont, Loader } from 'pixi.js';
import { createBorderTypes } from './dashedTextures';

const intervalToCheckBitmapFonts = 100;
const bitmapFonts = ['OpenSans', 'OpenSans-Bold', 'OpenSans-Italic', 'OpenSans-BoldItalic'];

function loadFont(fontName: string): void {
  const font = new FontFaceObserver(fontName);
  font.load();
}

export function ensureBitmapFontLoaded(resolve: () => void): void {
  const waitForLoad = () => {
    if (bitmapFonts.find((font) => !BitmapFont.available[font])) {
      setTimeout(waitForLoad, intervalToCheckBitmapFonts);
    } else {
      resolve();
    }
  };

  waitForLoad();
}

export function loadAssets(): Promise<void> {
  return new Promise((resolve) => {
    createBorderTypes();

    // Load HTML fonts for Input
    loadFont('OpenSans');
    loadFont('OpenSans-Bold');
    loadFont('OpenSans-Italic');
    loadFont('OpenSans-BoldItalic');

    // Load PixiJS fonts for canvas
    Loader.shared.add('OpenSans', '/fonts/opensans/OpenSans.fnt');
    Loader.shared.add('OpenSans-Bold', '/fonts/opensans/OpenSans-Bold.fnt');
    Loader.shared.add('OpenSans-Italic', '/fonts/opensans/OpenSans-Italic.fnt');
    Loader.shared.add('OpenSans-BoldItalic', '/fonts/opensans/OpenSans-BoldItalic.fnt');

    // CellsMarker
    Loader.shared.add('/images/formula-fx-icon.png');
    Loader.shared.add('/images/python-icon.png');

    // Wait until pixi fonts are loaded before resolving
    Loader.shared.load(() => ensureBitmapFontLoaded(resolve));
  });
}
