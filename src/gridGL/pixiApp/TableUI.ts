import { Container, Graphics, Rectangle, BitmapText } from 'pixi.js';
import { Table } from './Table';
import { intersects } from 'gridGL/helpers/intersects';
import { colors } from 'theme/colors';

const fontSize = 14;
const indicatorSize = 4;

export class TableUI extends Container {
  private table: Table;
  private title: BitmapText;
  private titleWidth = 0;
  private titleHeight = 0;
  private selection: Graphics;
  private dirty = true;
  private lastScale = 1;

  constructor(table: Table) {
    super();
    this.table = table;
    this.title = this.createTitle();
    this.selection = this.addChild(new Graphics());
  }

  private createTitle(): BitmapText {
    const title = this.addChild(new BitmapText('Table Title', { fontName: 'OpenSans', fontSize, tint: 0 }));
    title.anchor.set(0.5, 1);
    return title;
  }

  private updateSelection(): void {
    this.selection.clear();
    const { table } = this;
    const scale = table.app.viewport.scale.x;
    this.title.tint = table.selected ? colors.tableSelected.color : 0;
    if (!table.selected) return;
    const { actualWidth, actualHeight } = table;
    const { width, color, alpha } = colors.tableSelected;
    this.selection.lineStyle({ width: width / scale, color, alpha }).drawRect(0, 0, actualWidth, actualHeight);
    const size = indicatorSize / scale;
    this.selection
      .beginFill(0xffffff)
      .drawRect(actualWidth - size, actualHeight - size, size * 2, size * 2)
      .endFill();
  }

  update(): void {
    const { table } = this;
    const { viewport } = table.app;

    if (this.dirty) {
      this.dirty = false;

      // this.title.text = this.table.name;
      this.titleWidth = this.title.width;
      this.titleHeight = this.title.height;

      this.updateSelection();
    }

    if (viewport.dirty) {
      const viewportBounds = viewport.getVisibleBounds();
      if (
        intersects.rectangleRectangle(
          viewportBounds,
          new Rectangle(
            table.x - this.titleWidth / 2,
            table.y - this.titleHeight,
            table.width + this.titleWidth / 2,
            this.titleHeight
          )
        )
      ) {
        this.title.visible = true;
        const startX = Math.max(viewportBounds.left, table.x);
        const endX = Math.min(viewportBounds.right, table.x + table.actualWidth);
        this.title.x = startX + (endX - startX) / 2;
      } else {
        this.title.visible = false;
      }
      const scale = viewport.scale.x;
      if (this.lastScale !== scale) {
        this.lastScale = scale;
        this.title.scale.set(1 / scale);
        this.titleWidth = this.title.width;
        this.titleHeight = this.title.height;
        this.updateSelection();
      }
    }
  }
}
