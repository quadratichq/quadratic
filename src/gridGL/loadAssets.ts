import { Loader } from 'pixi.js';
import { createBorderTypes } from './dashedTextures';

export function loadAssets(): Promise<void> {
  return new Promise((resolve) => {
    createBorderTypes();
    Loader.shared.add('OpenSans', '/fonts/opensans/OpenSans.fnt');
    Loader.shared.add('OpenSans-Bold', '/fonts/opensans/OpenSans-Bold.fnt');
    Loader.shared.add('OpenSans-Italic', '/fonts/opensans/OpenSans-Italic.fnt');
    Loader.shared.add('OpenSans-BoldItalic', '/fonts/opensans/OpenSans-BoldItalic.fnt');

    // CellsMarker
    Loader.shared.add('images/formula-fx-icon.png');
    Loader.shared.add('images/python-icon.png');

    Loader.shared.load(() => resolve());
  });
}
