//! Used to draw autocomplete box.

import { events, type DirtyObject } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { content } from '@/app/gridGL/pixiApp/Content';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { colors } from '@/app/theme/colors';
import type { Rectangle } from 'pixi.js';
import { Graphics } from 'pixi.js';

const thickness = 3;

export class BoxCells extends Graphics {
  private gridRectangle?: Rectangle;
  private horizontalDelete = false;
  private verticalDelete = false;
  private deleteRectangles?: Rectangle[];
  dirty = false;

  constructor() {
    super();
    events.on('setDirty', this.setDirty);
  }

  destroy() {
    super.destroy();
    events.off('setDirty', this.setDirty);
  }

  private setDirty = (dirty: DirtyObject) => {
    if (dirty.boxCells) {
      this.dirty = true;
    }
  };

  /**
   * @param rectangle in grid coordinates
   */
  populate(options: {
    gridRectangle: Rectangle;
    horizontalDelete: boolean;
    verticalDelete: boolean;
    deleteRectangles: Rectangle[];
  }): void {
    this.gridRectangle = options.gridRectangle;
    this.horizontalDelete = options.horizontalDelete;
    this.verticalDelete = options.verticalDelete;
    this.deleteRectangles = options.deleteRectangles;
    this.dirty = true;
  }

  reset(): void {
    this.clear();
    this.dirty = false;
    this.gridRectangle = undefined;
    this.horizontalDelete = false;
    this.verticalDelete = false;
    this.deleteRectangles = undefined;
    pixiApp.setViewportDirty();
  }

  private drawRectangle(): void {
    if (!this.gridRectangle) return;
    const screenRectangle = sheets.sheet.getScreenRectangleFromRectangle(this.gridRectangle);
    this.dirty = false;
    this.clear();
    this.lineStyle({
      color: content.accentColor,
      alpha: colors.boxCellsAlpha,
      width: thickness,
    });
    this.moveTo(screenRectangle.x, screenRectangle.y);
    this.lineTo(screenRectangle.x, screenRectangle.y + screenRectangle.height);
    this.moveTo(screenRectangle.x + screenRectangle.width, screenRectangle.y);
    this.lineTo(screenRectangle.x + screenRectangle.width, screenRectangle.y + screenRectangle.height);
    this.lineStyle({
      color: content.accentColor,
      alpha: colors.boxCellsAlpha,
      width: thickness,
    });
    this.moveTo(screenRectangle.x, screenRectangle.y);
    this.lineTo(screenRectangle.x + screenRectangle.width, screenRectangle.y);
    this.moveTo(screenRectangle.x, screenRectangle.y + screenRectangle.height);
    this.lineTo(screenRectangle.x + screenRectangle.width, screenRectangle.y + screenRectangle.height);
  }

  private drawDeleteRectangles(): void {
    this.lineStyle(0);
    this.deleteRectangles?.forEach((rectangle) => {
      this.beginFill(colors.boxCellsDeleteColor, colors.boxCellsAlpha);
      const screenRectangle = sheets.sheet.getScreenRectangleFromRectangle(rectangle);
      screenRectangle.height++;
      this.drawShape(screenRectangle);
      this.endFill();
    });
  }

  update = () => {
    if (!this.dirty) {
      return;
    }
    this.dirty = false;

    if (!this.gridRectangle) {
      this.reset();
      return;
    }
    this.drawRectangle();
    this.drawDeleteRectangles();
  };

  isShowing(): boolean {
    return !!this.gridRectangle;
  }
}
