import { multiplayer } from '@/multiplayer/multiplayer';
import { Point } from 'pixi.js';
import { pixiApp } from '../../pixiApp/PixiApp';

export class PointerCursor {
  pointerMove(world: Point): void {
    const cursor = pixiApp.pointer.pointerHeading.cursor ?? pixiApp.pointer.pointerAutoComplete.cursor;
    pixiApp.canvas.style.cursor = cursor ?? 'unset';
    multiplayer.mouseMove(world.x, world.y);
  }
}
