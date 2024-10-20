import { sheets } from '@/app/grid/controller/Sheets';
import { DROPDOWN_SIZE } from '@/app/gridGL/cells/cellsLabel/drawSpecial';
import { getLanguageSymbol } from '@/app/gridGL/cells/CellsMarkers';
import { Table } from '@/app/gridGL/cells/tables/Table';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { OPEN_SANS_FIX } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellLabel';
import { BitmapText, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';

export const TABLE_NAME_FONT_SIZE = 12;
export const TABLE_NAME_PADDING = [4, 2];

const TABLE_NAME_HEIGHT = 20;
const DROPDOWN_PADDING = 10;
const SYMBOL_SCALE = 0.5;
const SYMBOL_PADDING = 5;

export class TableName extends Container {
  private table: Table;
  private background: Graphics;
  private symbol: Sprite | undefined;
  private text: BitmapText;
  private dropdown: Sprite;

  tableNameBounds: Rectangle;

  constructor(table: Table) {
    super();
    this.table = table;
    this.tableNameBounds = new Rectangle(0, 0, 0, TABLE_NAME_HEIGHT);
    this.background = this.addChild(new Graphics());
    this.text = this.addChild(new BitmapText('', { fontSize: TABLE_NAME_FONT_SIZE, fontName: 'OpenSans-Bold' }));
    this.symbol = this.addChild(new Sprite());
    this.dropdown = this.addChild(new Sprite(Texture.from('/images/dropdown-white.png')));
    this.dropdown.anchor.set(0.5);
    this.dropdown.width = DROPDOWN_SIZE[0];
    this.dropdown.height = DROPDOWN_SIZE[1];

    // we only add to overHeadings if the sheet is active
    if (sheets.sheet.id === this.table.sheet.id) {
      pixiApp.overHeadings.addChild(this);
    }
  }

  private drawBackground() {
    const width =
      this.text.width +
      OPEN_SANS_FIX.x +
      this.dropdown.width +
      DROPDOWN_PADDING +
      TABLE_NAME_PADDING[0] +
      (this.symbol ? SYMBOL_PADDING + this.symbol.width : 0);
    this.background.clear();
    this.background.beginFill(getCSSVariableTint('primary'));
    this.background.drawShape(new Rectangle(0, -TABLE_NAME_HEIGHT, width, TABLE_NAME_HEIGHT));
    this.background.endFill();

    this.tableNameBounds.width = width;
  }

  private drawSymbol() {
    if (this.symbol) {
      this.removeChild(this.symbol);
      this.symbol = undefined;
    }
    if (this.table.codeCell.language !== 'Import') {
      this.symbol = getLanguageSymbol(this.table.codeCell.language, false);
      if (this.symbol) {
        this.addChild(this.symbol);
        this.symbol.width = TABLE_NAME_HEIGHT * SYMBOL_SCALE;
        this.symbol.scale.y = this.symbol.scale.x;
        this.symbol.anchor.set(0, 0.5);
        this.symbol.y = -TABLE_NAME_HEIGHT / 2;
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
      -TABLE_NAME_HEIGHT / 2 + OPEN_SANS_FIX.y
    );
  }

  private drawDropdown() {
    this.dropdown.position.set(
      this.text.width +
        OPEN_SANS_FIX.x +
        DROPDOWN_PADDING +
        TABLE_NAME_PADDING[0] +
        (this.symbol ? SYMBOL_PADDING + this.symbol.width : 0),
      -TABLE_NAME_HEIGHT / 2
    );
  }

  update() {
    this.position.set(this.table.tableBounds.x, this.table.tableBounds.y);
    this.visible = false;

    this.drawSymbol();
    this.drawText();
    this.drawDropdown();
    this.drawBackground();

    this.tableNameBounds.x = this.table.tableBounds.x;
    this.tableNameBounds.y = this.table.tableBounds.y - TABLE_NAME_HEIGHT;
  }

  // Returns the table name bounds scaled to the viewport.
  getScaled() {
    const scaled = this.tableNameBounds.clone();
    scaled.width /= pixiApp.viewport.scaled;
    scaled.height /= pixiApp.viewport.scaled;
    scaled.y -= scaled.height - this.tableNameBounds.height;
    return scaled;
  }

  // Returns the width of the table name text scaled to the viewport.
  getScaledTextWidth() {
    return this.text.width / pixiApp.viewport.scaled;
  }
}
