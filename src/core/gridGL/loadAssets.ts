import * as PIXI from 'pixi.js';

export function loadAssets(): Promise<void> {
    return new Promise(resolve => {
        PIXI.Loader.shared.add('OpenSans', 'fonts/opensans/OpenSans.fnt')
            .load(() => resolve());
    });
}