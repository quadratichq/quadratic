import * as PIXI from 'pixi.js';
import FontFaceObserver from 'fontfaceobserver';

let count = 0;

function complete(resolve: Function) {
  count++;
  if (count === 2) resolve();
}

export function loadAssets(): Promise<void> {
  return new Promise((resolve) => {
    const font = new FontFaceObserver('OpenSans');
    font.load().then(() => complete(resolve));
    PIXI.Loader.shared.add('OpenSans', 'fonts/opensans/OpenSans.fnt').load(() => complete(resolve));
  });
}
