import { sheets } from '@/app/grid/controller/Sheets';
import { Sheet } from '@/app/grid/sheet/Sheet';
import { DROPDOWN_SIZE } from '@/app/gridGL/cells/cellsLabel/drawSpecial';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { JsRenderCodeCell } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import { FONT_SIZE, OPEN_SANS_FIX } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellLabel';
import { BitmapText, Container, Graphics, Point, Rectangle, Sprite, Texture } from 'pixi.js';

interface Column {
  heading: Container;
  bounds: Rectangle;
}

const DROPDOWN_PADDING = 10;
export const TABLE_NAME_PADDING = 4;

export class Table extends Container {
  private sheet: Sheet;
  private headingHeight = 0;
  private tableName: Container;
  private tableNameText: BitmapText;

  // holds all headings
  private headingContainer: Container;

  private outline: Graphics;
  private tableBounds: Rectangle;
  private headingBounds: Rectangle;
  private columns: Column[];

  tableNameBounds: Rectangle;
  codeCell: JsRenderCodeCell;

  constructor(sheet: Sheet, codeCell: JsRenderCodeCell) {
    super();
    this.codeCell = codeCell;
    this.sheet = sheet;
    this.tableName = new Container();
    this.tableNameText = new BitmapText(codeCell.name, {
      fontName: 'OpenSans',
      fontSize: FONT_SIZE,
      tint: getCSSVariableTint('primary-foreground'),
    });
    this.headingContainer = new Container();
    this.outline = new Graphics();
    this.tableBounds = new Rectangle();
    this.headingBounds = new Rectangle();
    this.tableNameBounds = new Rectangle();
    this.columns = [];
    this.updateCodeCell(codeCell);
  }

  redraw() {
    this.removeChildren();
    this.updateCodeCell(this.codeCell);
  }

  updateCodeCell = (codeCell: JsRenderCodeCell) => {
    this.codeCell = codeCell;
    this.tableBounds = this.sheet.getScreenRectangle(codeCell.x, codeCell.y, codeCell.w - 1, codeCell.h - 1);
    this.headingHeight = this.sheet.offsets.getRowHeight(codeCell.y);
    this.headingBounds = new Rectangle(
      this.tableBounds.x,
      this.tableBounds.y,
      this.tableBounds.width,
      this.headingHeight
    );
    this.position.set(this.headingBounds.x, this.headingBounds.y);

    this.addChild(this.headingContainer);

    // draw heading background
    const background = this.headingContainer.addChild(new Graphics());
    background.beginFill(colors.tableHeadingBackground);
    background.drawShape(new Rectangle(0, 0, this.headingBounds.width, this.headingBounds.height));
    background.endFill();

    // create column headings
    if (codeCell.show_header) {
      this.headingContainer.visible = true;
      let x = 0;
      this.columns = codeCell.column_names.map((column, index) => {
        const width = this.sheet.offsets.getColumnWidth(codeCell.x + index);
        const bounds = new Rectangle(x, this.headingBounds.y, width, this.headingBounds.height);
        const heading = this.headingContainer.addChild(new Container());
        heading.position.set(x + OPEN_SANS_FIX.x, OPEN_SANS_FIX.y);
        heading.addChild(
          new BitmapText(column.name, {
            fontName: 'OpenSans-Bold',
            fontSize: FONT_SIZE,
            tint: colors.tableHeadingForeground,
          })
        );

        x += width;
        return { heading, bounds };
      });
    } else {
      this.columns = [];
      this.headingContainer.visible = false;
    }

    // draw outline around entire table
    this.addChild(this.outline);
    this.outline.lineStyle({ color: getCSSVariableTint('primary'), width: 2, alignment: 0 });
    this.outline.drawShape(new Rectangle(0, 0, this.tableBounds.width, this.tableBounds.height));
    this.outline.visible = false;

    // draw table name
    if (sheets.sheet.id === this.sheet.id) {
      pixiApp.overHeadings.addChild(this.tableName);
    }
    this.tableName.position.set(this.tableBounds.x, this.tableBounds.y);
    const nameBackground = this.tableName.addChild(new Graphics());
    this.tableName.visible = false;
    const text = this.tableName.addChild(this.tableNameText);
    this.tableNameText.text = codeCell.name;
    text.position.set(OPEN_SANS_FIX.x + TABLE_NAME_PADDING, OPEN_SANS_FIX.y - this.headingBounds.height);

    const dropdown = this.tableName.addChild(this.drawDropdown());
    dropdown.position.set(
      text.width + OPEN_SANS_FIX.x + DROPDOWN_PADDING + TABLE_NAME_PADDING,
      -this.headingHeight / 2
    );

    nameBackground.beginFill(getCSSVariableTint('primary'));
    nameBackground.drawShape(
      new Rectangle(
        0,
        -this.headingBounds.height,
        text.width + OPEN_SANS_FIX.x + dropdown.width + DROPDOWN_PADDING + TABLE_NAME_PADDING,
        this.headingBounds.height
      )
    );
    nameBackground.endFill();
    this.tableNameBounds = new Rectangle(
      this.tableBounds.x,
      this.tableBounds.y - this.headingHeight,
      text.width + OPEN_SANS_FIX.x + dropdown.width + DROPDOWN_PADDING + TABLE_NAME_PADDING,
      this.headingBounds.height
    );
  };

  private drawDropdown() {
    const dropdown = new Sprite(Texture.from('/images/dropdown-white.png'));
    dropdown.width = DROPDOWN_SIZE[0];
    dropdown.height = DROPDOWN_SIZE[1];
    dropdown.anchor.set(0.5);
    return dropdown;
  }

  private tableNamePosition = (bounds: Rectangle, gridHeading: number) => {
    if (this.visible) {
      if (this.tableBounds.y < bounds.top + gridHeading) {
        this.tableName.y = bounds.top + gridHeading - this.tableBounds.top;
      } else {
        this.tableName.y = this.tableBounds.top;
      }
    }
  };

  private headingPosition = (bounds: Rectangle, gridHeading: number) => {
    if (this.visible) {
      if (this.headingBounds.top < bounds.top + gridHeading) {
        this.headingContainer.y = bounds.top + gridHeading - this.headingBounds.top;
      } else {
        this.headingContainer.y = 0;
      }
    }
  };

  intersectsCursor(x: number, y: number) {
    const rect = new Rectangle(this.codeCell.x, this.codeCell.y, this.codeCell.w - 1, this.codeCell.h - 1);
    if (intersects.rectanglePoint(rect, { x, y }) || intersects.rectangleRectangle(rect, this.headingBounds)) {
      this.showActive();
      return true;
    }
    return false;
  }

  // Returns the table name bounds scaled to the viewport.
  private getScaledTableNameBounds() {
    const scaled = this.tableNameBounds.clone();
    scaled.width /= pixiApp.viewport.scaled;
    scaled.height /= pixiApp.viewport.scaled;
    scaled.y -= scaled.height - this.tableNameBounds.height;
    return scaled;
  }

  // Checks whether the mouse cursor is hovering over the table or the table name
  checkHover(world: Point): boolean {
    return (
      intersects.rectanglePoint(this.tableBounds, world) ||
      intersects.rectanglePoint(this.getScaledTableNameBounds(), world)
    );
  }

  intersectsTableName(world: Point): { table: JsRenderCodeCell; nameOrDropdown: 'name' | 'dropdown' } | undefined {
    if (intersects.rectanglePoint(this.getScaledTableNameBounds(), world)) {
      if (world.x <= this.tableNameBounds.x + this.tableNameText.width / pixiApp.viewport.scaled) {
        return { table: this.codeCell, nameOrDropdown: 'name' };
      }
      return { table: this.codeCell, nameOrDropdown: 'dropdown' };
    }
  }

  update(bounds: Rectangle, gridHeading: number) {
    this.visible = intersects.rectangleRectangle(this.tableBounds, bounds);
    this.headingPosition(bounds, gridHeading);
    if (this.isShowingTableName()) {
      this.tableName.scale.set(1 / pixiApp.viewport.scale.x);
      this.tableNamePosition(bounds, gridHeading);
    }
  }

  hideActive() {
    this.outline.visible = false;
    this.tableName.visible = false;
    pixiApp.setViewportDirty();
  }

  showActive() {
    this.outline.visible = true;
    this.tableName.visible = true;
    pixiApp.setViewportDirty();
  }

  showTableName() {
    pixiApp.overHeadings.addChild(this.tableName);
  }

  hideTableName() {
    pixiApp.overHeadings.removeChild(this.tableName);
  }

  private isShowingTableName(): boolean {
    return this.tableName.parent !== undefined;
  }
}
