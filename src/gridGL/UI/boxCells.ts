import { Graphics, Rectangle } from 'pixi.js';
import { PixiApp } from '../pixiApp/PixiApp';
import { colors } from '../../theme/colors';

const thickness = 3;

export class BoxCells extends Graphics {
  private app: PixiApp;
  private gridRectangle?: Rectangle;
  private screenRectangle?: Rectangle;
  private deleteCells = false;
  dirty = false;

  constructor(app: PixiApp) {
    super();
    this.app = app;
  }

  /**
   * @param rectangle in grid coordinates
   */
  populate(rectangle: Rectangle, deleteCells: boolean): void {
    this.gridRectangle = rectangle;
    this.deleteCells = deleteCells;
    this.dirty = true;
  }

  reset(): void {
    this.clear();
    this.dirty = false;
    this.gridRectangle = undefined;
    this.screenRectangle = undefined;
  }

  update() {
    if (this.dirty) {
      if (!this.gridRectangle) {
        this.reset();
        return;
      }
      this.screenRectangle = this.app.sheet.gridOffsets.getScreenRectangle(
        this.gridRectangle.x,
        this.gridRectangle.y,
        this.gridRectangle.width,
        this.gridRectangle.height
      );
      this.dirty = false;
      this.clear();
      this.lineStyle({
        color: this.deleteCells ? colors.boxCellsDeleteColor : colors.boxCellsColor,
        alpha: colors.boxCellsAlpha,
        width: thickness,
      });
      this.drawShape(this.screenRectangle);
    }
  }

  isShowing(): boolean {
    return !!this.gridRectangle;
  }
}
