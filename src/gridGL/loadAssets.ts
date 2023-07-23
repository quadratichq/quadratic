import { BitmapFont, Loader } from 'pixi.js';
import FontFaceObserver from 'fontfaceobserver';
import { createBorderTypes } from './dashedTextures';

const TOTAL = 5;

let count = 0;

function complete(resolve: Function) {
  count++;
  if (count === TOTAL) {
    console.log(Loader.shared.resources, BitmapFont.available);
    resolve();
  }
}

function loadFont(resolve: Function, fontName: string): void {
  const font = new FontFaceObserver(fontName);
  font.load(null, 100000).then(() => complete(resolve));
}

export function loadAssets(): Promise<void> {
  return new Promise((resolve) => {
    loadFont(resolve, 'OpenSans');
    loadFont(resolve, 'OpenSans-Bold');
    loadFont(resolve, 'OpenSans-Italic');
    loadFont(resolve, 'OpenSans-BoldItalic');
    Loader.shared.add('OpenSans', '/fonts/opensans/OpenSans.fnt');
    Loader.shared.add('OpenSans-Bold', '/fonts/opensans/OpenSans-Bold.fnt');
    Loader.shared.add('OpenSans-Italic', '/fonts/opensans/OpenSans-Italic.fnt');
    Loader.shared.add('OpenSans-BoldItalic', '/fonts/opensans/OpenSans-BoldItalic.fnt');
    Loader.shared.load(() => complete(resolve));
    createBorderTypes();
  });
}
