import { BitmapText, Container, Matrix, MIPMAP_MODES, Rectangle, RenderTexture, Sprite, Text } from 'pixi.js';
import { debugShowCacheInfo, debugShowSubCacheInfo, debugShowTime } from '../../../debugFlags';
import { nextPowerOf2 } from '../helpers/zoom';
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
  private _dirty = true;
  private debugColor?: number;
  visibleRectangle!: Rectangle;
  location: Coordinate;

  constructor(app: PixiApp, quadrantX: number, quadrantY: number) {
    super();
    this.app = app;
    this.location = { x: quadrantX, y: quadrantY };
    this.subquadrants = [];
    this.reposition();
  }

  reposition() {
    const oldRectangle = this.visibleRectangle;
    const columnStart = this.location.x * QUADRANT_COLUMNS;
    const rowStart = this.location.y * QUADRANT_ROWS;
    this.visibleRectangle = this.app.sheet.gridOffsets.getScreenRectangle(
      columnStart,
      rowStart,
      QUADRANT_COLUMNS - 2,
      QUADRANT_ROWS - 2
    );

    // reposition subQuadrants based on any deltas
    if (oldRectangle) {
      const deltaX = this.visibleRectangle.x - oldRectangle.x;
      const deltaY = this.visibleRectangle.y - oldRectangle.y;
      if (deltaX || deltaY) {
        this.children.forEach((child) => {
          child.x += deltaX;
          child.y += deltaY;
        });
      }
    }
  }

  set dirty(value: boolean) {
    if (this._dirty !== value) {
      this._dirty = value;
      this.visible = !value;
    }
  }
  get dirty(): boolean {
    return this._dirty;
  }

  // creates/reuses a Sprite with an appropriately sized RenderTexture
  private getSubQuadrant(subQuadrantX: number, subQuadrantY: number, size: number): SubQuadrant {
    let sprite = this.subquadrants.find((child) => {
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
      const texture = RenderTexture.create({
        width: size,
        height: size,
        resolution: window.devicePixelRatio,
        mipmap: MIPMAP_MODES.ON,
      });
      sprite = this.addChild(new Sprite(texture)) as SubQuadrant;
      sprite.scale.set(1 / QUADRANT_SCALE);
      sprite.subQuadrantX = subQuadrantX;
      sprite.subQuadrantY = subQuadrantY;
      this.subquadrants.push(sprite);
    }
    return sprite;
  }

  private clear(): void {
    this.subquadrants.forEach((subquadrant) => (subquadrant.visible = false));
  }

  update(timeStart?: number, debug?: string): void {
    if (!this.dirty) return;
    this.clear();
    const app = this.app;

    const columnStart = this.location.x * QUADRANT_COLUMNS;
    const rowStart = this.location.y * QUADRANT_ROWS;
    const screenRectangle = app.sheet.gridOffsets.getScreenRectangle(
      columnStart,
      rowStart,
      QUADRANT_COLUMNS,
      QUADRANT_ROWS
    );

    // number of subquadrants necessary (should be equal to 1 unless heading size has changed)
    const xCount = Math.ceil(screenRectangle.width / QUADRANT_TEXTURE_SIZE);
    const yCount = Math.ceil(screenRectangle.height / QUADRANT_TEXTURE_SIZE);

    const subQuadrantWidth = screenRectangle.width / xCount;
    const subQuadrantHeight = screenRectangle.height / yCount;

    for (let subQuadrantY = 0; subQuadrantY < yCount; subQuadrantY++) {
      for (let subQuadrantX = 0; subQuadrantX < xCount; subQuadrantX++) {
        const cellBounds = new Rectangle(
          screenRectangle.x + subQuadrantX * subQuadrantWidth,
          screenRectangle.y + subQuadrantY * subQuadrantHeight,
          subQuadrantWidth,
          subQuadrantHeight
        );

        // draw quadrant and return the reduced subQuadrant rectangle (ie, shrinks the texture based on what was actually drawn)
        const reducedDrawingRectangle = app.cells.drawCells(cellBounds, true);

        if (reducedDrawingRectangle) {
          // prepare a transform to translate the world to the start of the content for this subQuadrant, and properly scale it
          const transform = new Matrix();
          transform.translate(-reducedDrawingRectangle.left, -reducedDrawingRectangle.top);
          transform.scale(QUADRANT_SCALE, QUADRANT_SCALE);

          // get the Sprite and resize the texture if needed
          const size = Math.max(
            nextPowerOf2(reducedDrawingRectangle.width),
            nextPowerOf2(reducedDrawingRectangle.height)
          );
          const subQuadrant = this.getSubQuadrant(subQuadrantX, subQuadrantY, size);

          if (debugShowSubCacheInfo) {
            console.log(
              `[Quadrant] ${this.debugName()}.[${subQuadrantX},${subQuadrantY}] [${cellBounds.toString()} texture size: ${size}`
            );
          }

          // render the sprite's texture
          const container = app.prepareForQuadrantRendering();
          app.renderer.render(container, { renderTexture: subQuadrant.texture, transform, clear: true });
          app.cleanUpAfterQuadrantRendering();
          subQuadrant.position.set(reducedDrawingRectangle.left, reducedDrawingRectangle.top);
        }
      }
    }
    this.visibleRectangle = screenRectangle;

    if (debugShowTime && debugShowCacheInfo && timeStart) {
      console.log(`[Quadrant] Rendered ${this.debugName()} ${debug} (${Math.round(performance.now() - timeStart)} ms)`);
    }
    this.dirty = false;
  }

  debugName(): string {
    return `Q[${this.location.x},${this.location.y}]`;
  }

  debugTextureCount(): number {
    return this.children.reduce((count, child) => count + (child.visible ? 1 : 0), 0);
  }

  debugDraw(): void {
    if (this.debugColor === undefined) {
      this.debugColor = Math.floor(Math.random() * 0xffffff);
    }
    this.app.debug.lineStyle({ color: 0, width: 1 });
    this.app.debug.beginFill(0xff0000, 0.1).drawShape(this.visibleRectangle).endFill();
    if (this.subquadrants.length) {
      const text = this.app.debug.addChild(new BitmapText(`${this.location.x}, ${this.location.y}`, { fontName: 'OpenSans' }))
      text.position.set(this.subquadrants[0].x, this.subquadrants[0].y);
      this.subquadrants.forEach(subquadrant => {
        this.app.debug
          .beginFill(this.debugColor, 0.5)
          .drawRect(subquadrant.x, subquadrant.y, subquadrant.width, subquadrant.height)
          .endFill();
        const text = this.app.debug.addChild(new BitmapText(`${subquadrant.subQuadrantX}, ${subquadrant.subQuadrantY} [${this.location.x}, ${this.location.y}]`, { fontName: 'OpenSans' }));
        text.tint = 0xff0000;
        text.position.set(subquadrant.x + subquadrant.width - text.width, subquadrant.y);
      });
    }
  }
}
