import { DROPDOWN_SIZE } from '@/app/gridGL/cells/cellsLabel/drawSpecial';
import { getLanguageSymbol } from '@/app/gridGL/cells/CellsMarkers';
import type { Table } from '@/app/gridGL/cells/tables/Table';
import type { TablePointerDownResult } from '@/app/gridGL/cells/tables/Tables';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { OPEN_SANS_FIX } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellLabel';
import { CELL_HEIGHT } from '@/shared/constants/gridConstants';
import { sharedEvents } from '@/shared/sharedEvents';
import type { Point } from 'pixi.js';
import { BitmapText, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';

export const TABLE_NAME_FONT_SIZE = 12;
export const TABLE_NAME_PADDING = [4, 2];

const DROPDOWN_PADDING = 10;
const SYMBOL_SCALE = 0.5;
const SYMBOL_PADDING = 5;

export class TableName extends Container {
  // height of the table name's row
  private h = 0;

  private table: Table;
  private background: Graphics;
  private symbol: Sprite | undefined;
  private text: BitmapText;
  private dropdown: Sprite;
  private backgroundWidth = 0;

  // hidden by Tables
  hidden: boolean = true;

  constructor(table: Table) {
    super();
    this.table = table;
    this.background = this.addChild(new Graphics());
    this.text = this.addChild(new BitmapText('', { fontSize: TABLE_NAME_FONT_SIZE, fontName: 'OpenSans-Bold' }));
    this.symbol = this.addChild(new Sprite());
    this.dropdown = this.addChild(new Sprite(Texture.from('/images/dropdown-white.png')));
    this.dropdown.anchor.set(0.5);
    this.dropdown.width = DROPDOWN_SIZE[0];
    this.dropdown.height = DROPDOWN_SIZE[1];

    // // we only add to overHeadings if the sheet is active
    // if (sheets.sheet.id === this.table.sheet.id) {
    //   pixiApp.overHeadingsTableNames.addChild(this);
    // }
    sharedEvents.on('changeThemeAccentColor', this.drawBackground);
  }

  destroy() {
    sharedEvents.off('changeThemeAccentColor', this.drawBackground);
    super.destroy();
  }

  private drawBackground = () => {
    // this.text.width +
    // OPEN_SANS_FIX.x +
    // this.dropdown.width +
    // DROPDOWN_PADDING +
    // TABLE_NAME_PADDING[0] +
    // (this.symbol ? SYMBOL_PADDING + this.symbol.width : 0);
    this.background.clear();
    this.background.beginFill(getCSSVariableTint('primary'));
    this.background.drawShape(new Rectangle(0, 0, this.table.tableBounds.width, this.h));
    this.background.endFill();

    this.backgroundWidth = this.table.tableBounds.width;
  };

  private drawSymbol() {
    if (this.symbol) {
      this.removeChild(this.symbol);
      this.symbol = undefined;
    }
    if (this.table.codeCell.language !== 'Import') {
      this.symbol = getLanguageSymbol(this.table.codeCell.language, false);
      if (this.symbol) {
        this.addChild(this.symbol);
        this.symbol.width = CELL_HEIGHT * SYMBOL_SCALE;
        this.symbol.scale.y = this.symbol.scale.x;
        this.symbol.anchor.set(0, 0.5);
        this.symbol.y = this.h / 2;
        this.symbol.x = SYMBOL_PADDING;
        if (this.table.codeCell.language === 'Formula' || this.table.codeCell.language === 'Python') {
          this.symbol.tint = 0xffffff;
        }
      }
    }
  }

  private drawText() {
    this.text.text = this.table.codeCell.name;
    this.text.anchor.set(0, 0.5);
    this.text.position.set(
      TABLE_NAME_PADDING[0] + (this.symbol ? SYMBOL_PADDING + this.symbol.width : 0),
      OPEN_SANS_FIX.y + this.h / 2
    );
  }

  private drawDropdown() {
    this.dropdown.position.set(
      this.text.width +
        OPEN_SANS_FIX.x +
        DROPDOWN_PADDING +
        TABLE_NAME_PADDING[0] +
        (this.symbol ? SYMBOL_PADDING + this.symbol.width : 0),
      this.text.y // + this.text.height / 2
    );
  }

  updatePosition = (bounds: Rectangle, gridHeading: number) => {
    if (this.table.visible) {
      if (this.table.tableBounds.y < bounds.top + gridHeading) {
        this.y = bounds.top + gridHeading;
      } else {
        this.y = this.table.tableBounds.top;
      }
      const headingWidth = pixiApp.headings.headingSize.width / pixiApp.viewport.scaled;
      if (!this.hidden) {
        if (this.table.tableBounds.x < bounds.left + headingWidth) {
          this.x = bounds.left + headingWidth;
          this.visible = this.x + this.width <= this.table.tableBounds.right;
        } else {
          this.x = this.table.tableBounds.x;
          this.visible = true;
        }
      }
    }
  };

  update() {
    this.h = this.table.sheet.offsets.getRowHeight(this.table.codeCell.y);
    this.drawSymbol();
    this.drawText();
    this.drawDropdown();
    this.drawBackground();
  }

  get tableNameBounds(): Rectangle {
    const rect = new Rectangle(0, 0, this.backgroundWidth, CELL_HEIGHT);
    if (this.table.inOverHeadings) {
      // rect.x = this.table.columnHeaders.x;
      // rect.y = this.table.columnHeaders.y - CELL_HEIGHT;
    } else {
      rect.x = this.table.tableBounds.x;
      rect.y = this.table.tableBounds.y - CELL_HEIGHT;
    }
    return rect;
  }

  // // Returns the table name bounds scaled to the viewport.
  // getScaled() {
  //   const scaled = this.tableNameBounds;
  //   const originalHeight = scaled.height;
  //   scaled.width /= pixiApp.viewport.scaled;
  //   scaled.height /= pixiApp.viewport.scaled;
  //   scaled.y -= scaled.height - originalHeight;
  //   return scaled;
  // }

  // // Returns the width of the table name text scaled to the viewport.
  // getScaledTextWidth() {
  //   return (this.tableNameBounds.width - this.dropdown.width - DROPDOWN_PADDING) / pixiApp.viewport.scaled;
  // }

  intersects(world: Point): TablePointerDownResult | undefined {
    // if (this.visible && intersects.rectanglePoint(this.bounds(), world)) {
    //   if (world.x <= this.x + this.getScaledTextWidth()) {
    //     return { table: this.table.codeCell, type: 'table-name' };
    //   }
    //   return { table: this.table.codeCell, type: 'dropdown' };
    // }
    return undefined;
  }

  hide() {
    this.visible = false;
    this.hidden = true;
  }

  show() {
    this.visible = true;
    this.hidden = false;
  }
}
