import { Graphics, Rectangle } from 'pixi.js';
import { PixiApp } from '../pixiApp/PixiApp';
import { colors } from '../../theme/colors';

const thickness = 3;

export class BoxCells extends Graphics {
  private app: PixiApp;
  private gridRectangle?: Rectangle;
  private horizontalDelete = false;
  private verticalDelete = false;
  private deleteRectangles?: Rectangle[];
  dirty = false;

  constructor(app: PixiApp) {
    super();
    this.app = app;
  }

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
  }

  private drawRectangle(): void {
    if (!this.gridRectangle) return;
    const screenRectangle = this.app.sheet.gridOffsets.getScreenRectangle(
      this.gridRectangle.x,
      this.gridRectangle.y,
      this.gridRectangle.width,
      this.gridRectangle.height
    );
    this.dirty = false;
    this.clear();
    this.lineStyle({
      color: colors.boxCellsColor,
      alpha: colors.boxCellsAlpha,
      width: thickness,
    });
    this.moveTo(screenRectangle.x, screenRectangle.y);
    this.lineTo(screenRectangle.x, screenRectangle.y + screenRectangle.height);
    this.moveTo(screenRectangle.x + screenRectangle.width, screenRectangle.y);
    this.lineTo(screenRectangle.x + screenRectangle.width, screenRectangle.y + screenRectangle.height);
    this.lineStyle({
      color: colors.boxCellsColor,
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
      const screenRectangle = this.app.sheet.gridOffsets.getScreenRectangle(
        rectangle.x,
        rectangle.y,
        rectangle.width,
        rectangle.height
      );
      screenRectangle.height++;
      this.drawShape(screenRectangle);
      this.endFill();
    });
  }

  update() {
    if (this.dirty) {
      if (!this.gridRectangle) {
        this.reset();
        return;
      }
      this.drawRectangle();
      this.drawDeleteRectangles();
    }
  }

  isShowing(): boolean {
    return !!this.gridRectangle;
  }
}
