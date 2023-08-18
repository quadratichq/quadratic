import FontFaceObserver from 'fontfaceobserver';
import { Loader } from 'pixi.js';
import { createBorderTypes } from './dashedTextures';

const TOTAL = 5;

let count = 0;

function complete(resolve: Function) {
  count++;
  if (count === TOTAL) {
    resolve();
  }
}

function loadFont(resolve: Function, fontName: string): void {
  const font = new FontFaceObserver(fontName);
  font.load(null, 100000).then(() => complete(resolve));
}

export function loadAssets(): Promise<void> {
  return new Promise((resolve) => {
    // Fonts for PIXI.Text
    loadFont(resolve, 'OpenSans');
    loadFont(resolve, 'OpenSans-Bold');
    loadFont(resolve, 'OpenSans-Italic');
    loadFont(resolve, 'OpenSans-BoldItalic');

    // CellsLabel
    Loader.shared.add('OpenSans', 'fonts/opensans/OpenSans.fnt');
    Loader.shared.add('OpenSans-Bold', 'fonts/opensans/OpenSans-Bold.fnt');
    Loader.shared.add('OpenSans-Italic', 'fonts/opensans/OpenSans-Italic.fnt');
    Loader.shared.add('OpenSans-BoldItalic', 'fonts/opensans/OpenSans-BoldItalic.fnt');

    // CellsMarker
    Loader.shared.add('images/formula-fx-icon.png');
    Loader.shared.add('images/python-icon.png');

    Loader.shared.load(() => complete(resolve));
    createBorderTypes();
  });
}
