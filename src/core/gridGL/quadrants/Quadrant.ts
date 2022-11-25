import { Container, Matrix, MIPMAP_MODES, RenderTexture, Sprite } from 'pixi.js';
import { debugShowCacheInfo, debugShowSubCacheInfo, debugShowTime } from '../../../debugFlags';
import { nearestPowerOf2 } from '../helpers/zoom';
import { PixiApp } from '../pixiApp/PixiApp';
import { Coordinate } from '../types/size';
import { QUADRANT_COLUMNS, QUADRANT_ROWS, QUADRANT_SCALE, QUADRANT_TEXTURE_SIZE } from './quadrantConstants';

// subquadrants are sprites that live within a quadrant mapped to a rendered texture size
interface SubQuadrant extends Sprite {
  subQuadrantX: number;
  subQuadrantY: number;
  texture: RenderTexture;
}

// A quadrant is a cached portion of the sheet mapped to column, row size (which can change based on heading size)
// at the default heading size, one subquadrant is needed per quadrant
export class Quadrant extends Container {
  private app: PixiApp;
  private subquadrants: SubQuadrant[];
  private location: Coordinate;
  dirty = true;

  constructor(app: PixiApp, quadrantX: number, quadrantY: number) {
    super();
    this.app = app;
    this.location = { x: quadrantX, y: quadrantY };
    this.subquadrants = [];
  }

  // creates/reuses a Sprite with an appropriately sized RenderTexture
  private getSubQuadrant(subQuadrantX: number, subQuadrantY: number, size: number): SubQuadrant {
    let sprite = this.subquadrants.find(child => {
      const spriteQuadrant = child as SubQuadrant;
      if (spriteQuadrant.subQuadrantX === subQuadrantX && spriteQuadrant.subQuadrantY === subQuadrantY) {
        return true;
      }
      return false;
    }) as SubQuadrant;
    if (sprite) {

      // reuse existing sprite and resize texture if needed
      if (sprite.texture.width !== size || sprite.texture.height !== size) {
        sprite.texture.resize(size, size);
      }
      sprite.visible = true;
    } else {

      // create and position a Sprite with the appropriately sized RenderTexture
      const texture = RenderTexture.create({ width: size, height: size, resolution: window.devicePixelRatio, mipmap: MIPMAP_MODES.ON_MANUAL });
      sprite = this.addChild(new Sprite(texture)) as SubQuadrant;
      sprite.scale.set(1 / QUADRANT_SCALE);
      sprite.subQuadrantX = subQuadrantX;
      sprite.subQuadrantY = subQuadrantY;
      this.subquadrants.push(sprite);
    }
    return sprite;
  }

  private clear(): void {
    this.subquadrants.forEach(subquadrant => (subquadrant.visible = false));
  }

  update(timeStart?: number, debug?: string): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.clear();

    const app = this.app;

    const columnStart = this.location.x * QUADRANT_COLUMNS;
    const rowStart = this.location.y * QUADRANT_ROWS;

    const screenRectangle = app.gridOffsets.getScreenRectangle(columnStart, rowStart, QUADRANT_COLUMNS - 2, QUADRANT_ROWS - 2);

    // number of subquadrants necessary (should be equal to 1 unless heading size has changed)
    const xCount = Math.ceil(screenRectangle.width / QUADRANT_TEXTURE_SIZE);
    const yCount = Math.ceil(screenRectangle.height / QUADRANT_TEXTURE_SIZE);

    const subQuadrantWidth = screenRectangle.width / xCount;
    const subQuadrantHeight = screenRectangle.height / yCount;

    for (let subQuadrantY = 0; subQuadrantY < yCount; subQuadrantY++) {
      for (let subQuadrantX = 0; subQuadrantX < xCount; subQuadrantX++) {

        const cellBounds = app.gridOffsets.getCellRectangle(screenRectangle.x + subQuadrantX * subQuadrantWidth, screenRectangle.y + subQuadrantY * subQuadrantHeight, subQuadrantWidth, subQuadrantHeight);
        const cellRectangle = app.grid.getCells(cellBounds);

        // returns the reduced subQuadrant rectangle (ie, shrinks the texture based on what was actually drawn)
        const reducedDrawingRectangle = app.cells.drawBounds(cellBounds, cellRectangle);
        if (reducedDrawingRectangle) {

          // prepare a transform to translate the world to the start of the content for this subQuadrant, and properly scale it
          const transform = new Matrix();
          transform.translate(-reducedDrawingRectangle.left, -reducedDrawingRectangle.top);
          transform.scale(QUADRANT_SCALE, QUADRANT_SCALE);

          // get the Sprite and render to the Sprite's texture
          const size = Math.max(nearestPowerOf2(reducedDrawingRectangle.width), nearestPowerOf2(reducedDrawingRectangle.height));
          const subQuadrant = this.getSubQuadrant(subQuadrantX, subQuadrantY, size);

          if (debugShowSubCacheInfo) {
            console.log(`Quadrant [${this.location.x},${this.location.y}] - Subquadrant [${subQuadrantX},${subQuadrantY}] texture size: ${size}`);
          }

          const container = app.prepareForQuadrantRendering();
          app.renderer.render(container, { renderTexture: subQuadrant.texture, transform, clear: true });
          app.cleanUpAfterQuadrantRendering();
          subQuadrant.position.set(reducedDrawingRectangle.left, reducedDrawingRectangle.top)
        }
      }
    }
    if (debugShowTime && debugShowCacheInfo && timeStart) {
      console.log(`[Quadrant] Rendered ${this.getName()} ${debug} (${Math.round(performance.now() - timeStart)} ms)`);
    }
  }

  getName(): string {
    return `Q[${this.location.x},${this.location.y}]`;
  }
}