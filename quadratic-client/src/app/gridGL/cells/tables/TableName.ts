import { sheets } from '@/app/grid/controller/Sheets';
import { DROPDOWN_SIZE } from '@/app/gridGL/cells/cellsLabel/drawSpecial';
import { getLanguageSymbol } from '@/app/gridGL/cells/CellsMarkers';
import type { Table } from '@/app/gridGL/cells/tables/Table';
import type { TablePointerDownResult } from '@/app/gridGL/cells/tables/Tables';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import type { CodeCellLanguage } from '@/app/quadratic-core-types';
import { LINE_HEIGHT, OPEN_SANS_FIX } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellLabel';
import { CELL_HEIGHT, DEFAULT_FONT_SIZE } from '@/shared/constants/gridConstants';
import { sharedEvents } from '@/shared/sharedEvents';
import { timeAgoAndNextTimeout } from '@/shared/utils/timeAgo';
import type { Point } from 'pixi.js';
import { Assets, BitmapText, Container, Graphics, Rectangle, Sprite } from 'pixi.js';

const TABLE_MODIFIED_FONT_SIZE = 10;
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

  private modified?: BitmapText;
  private modifiedTimeout?: number;

  private dropdown: Sprite;
  private backgroundWidth = 0;

  // Rotation animation state
  private rotationStartTime = 0;
  private rotationSpeed = 0.003; // radians per millisecond (roughly 1 rotation per 2 seconds)

  tableNameBounds = new Rectangle();

  constructor(table: Table) {
    super();
    this.table = table;
    this.background = this.addChild(new Graphics());
    this.text = this.addChild(new BitmapText('', { fontSize: DEFAULT_FONT_SIZE, fontName: 'OpenSans-Bold' }));
    this.symbol = this.addChild(new Sprite());
    if (table.codeCell.is_code) {
      this.modified = this.addChild(new BitmapText('', { fontSize: TABLE_MODIFIED_FONT_SIZE, fontName: 'OpenSans' }));
    }
    const dropdownWhiteIconTexture = Assets.get('dropdown-white-icon');
    this.dropdown = this.addChild(new Sprite(dropdownWhiteIconTexture));
    this.dropdown.anchor.set(0.5, 0);
    this.dropdown.width = DROPDOWN_SIZE[0];
    this.dropdown.height = DROPDOWN_SIZE[1];

    sharedEvents.on('changeThemeAccentColor', this.drawBackground);
  }

  destroy = () => {
    sharedEvents.off('changeThemeAccentColor', this.drawBackground);
    if (this.modifiedTimeout) {
      clearTimeout(this.modifiedTimeout);
      this.modifiedTimeout = undefined;
    }
    super.destroy();
  };

  private drawBackground = () => {
    this.backgroundWidth = this.table.tableBounds.width;
    this.background.clear();
    const color = this.table.active ? 'primary' : 'muted-foreground';
    this.background.beginFill(getCSSVariableTint(color));
    this.background.drawShape(new Rectangle(0, 0, this.backgroundWidth, this.h));
    this.background.endFill();
  };

  private currentLanguage?: CodeCellLanguage;

  private drawSymbol = () => {
    // Only spin when actually running (not when awaiting)
    const isRunning = this.table.running === true;
    const language = this.table.codeCell.language;

    // Only recreate symbol if language changed or symbol doesn't exist
    const needsRecreate = !this.symbol || this.currentLanguage !== language;

    if (needsRecreate) {
      // Preserve rotation state before recreating symbol (only if actually running)
      const shouldPreserveRotation = isRunning && this.rotationStartTime !== 0;
      const rotationToPreserve = this.symbol?.rotation ?? 0;

      if (this.symbol) {
        this.removeChild(this.symbol);
        this.symbol = undefined;
      }

      if (language !== 'Import') {
        this.symbol = getLanguageSymbol(language);
        if (this.symbol) {
          this.addChild(this.symbol);
          this.symbol.width = CELL_HEIGHT * SYMBOL_SCALE;
          this.symbol.scale.y = this.symbol.scale.x;
          this.symbol.anchor.set(0.5, 0.5);
          this.symbol.y = this.h / 2;
          this.symbol.x = SYMBOL_PADDING + (CELL_HEIGHT * SYMBOL_SCALE) / 2;
          if (language === 'Formula' || language === 'Python' || language === 'Javascript') {
            this.symbol.tint = 0xffffff;
          }
          // Preserve rotation if we were running, otherwise reset
          if (shouldPreserveRotation) {
            this.symbol.rotation = rotationToPreserve;
          } else {
            this.symbol.rotation = 0;
            if (!isRunning) {
              this.rotationStartTime = 0;
            }
          }
        }
        this.currentLanguage = language;
      } else {
        this.currentLanguage = undefined;
        if (!isRunning) {
          this.rotationStartTime = 0;
        }
      }
    } else if (this.symbol) {
      // Update position if height changed
      this.symbol.y = this.h / 2;
    }
  };

  private updateSymbolRotation = () => {
    // Only spin when actually running (not when awaiting)
    const isRunning = this.table.running === true;

    // Early return if not running and rotation is already reset
    if (!isRunning) {
      if (this.rotationStartTime === 0 && (!this.symbol || this.symbol.rotation === 0)) {
        return; // Already reset, no work needed
      }
      // Reset rotation when not running (only if needed)
      if (this.symbol && this.symbol.rotation !== 0) {
        this.symbol.rotation = 0;
        const bounds = pixiApp.viewport.getVisibleBounds();
        if (bounds.intersects(this.tableNameBounds) && this.table.sheet.id === sheets.current) {
          pixiApp.setViewportDirty();
        }
      }
      this.rotationStartTime = 0;
      return;
    }

    // Running: update rotation
    if (!this.symbol) return; // No symbol to rotate

    // Start rotation timer if not already started
    if (this.rotationStartTime === 0) {
      this.rotationStartTime = Date.now();
    }

    // Calculate rotation based on elapsed time
    const elapsed = Date.now() - this.rotationStartTime;
    const newRotation = elapsed * this.rotationSpeed;

    // Only update if rotation changed significantly
    if (Math.abs(this.symbol.rotation - newRotation) > 0.001) {
      this.symbol.rotation = newRotation;
      // Mark viewport as dirty to ensure smooth continuous animation, but only if table is on current sheet
      const bounds = pixiApp.viewport.getVisibleBounds();
      if (bounds.intersects(this.tableNameBounds) && this.table.sheet.id === sheets.current) {
        pixiApp.setViewportDirty();
      }
    } else {
      // Even if rotation didn't change much, mark dirty to keep animation loop going, but only if table is on current sheet
      const bounds = pixiApp.viewport.getVisibleBounds();
      if (bounds.intersects(this.tableNameBounds) && this.table.sheet.id === sheets.current) {
        pixiApp.setViewportDirty();
      }
    }
  };

  private drawText() {
    this.text.text = this.table.codeCell.name;
    this.text.anchor.set(0, 0);

    // Calculate available space for vertical positioning (use LINE_HEIGHT like CellLabel)
    const textHeight = LINE_HEIGHT;
    const availableSpace = this.h - textHeight;

    // Calculate vertical position
    const yPos = Math.max(0, availableSpace / 2);

    this.text.position.set(
      TABLE_NAME_PADDING[0] + (this.symbol ? SYMBOL_PADDING + this.symbol.width : 0),
      OPEN_SANS_FIX.y + yPos
    );

    // truncate the name if it's too long
    let name = this.table.codeCell.name;
    while (
      name &&
      this.text.x + this.text.width + TABLE_NAME_PADDING[0] + (this.symbol ? SYMBOL_PADDING + this.symbol.width : 0) >
        this.table.tableBounds.width
    ) {
      name = name.slice(0, -1);
      this.text.text = name + '…';
    }
  }

  private drawDropdown() {
    // Position dropdown vertically centered with the table name row (this.h)
    // Dropdown anchor is (0.5, 0) so y position is the top of the dropdown
    const rowCenterY = this.h / 2;
    const dropdownTopY = rowCenterY - this.dropdown.height / 2;

    this.dropdown.position.set(this.text.x + this.text.width + DROPDOWN_PADDING, dropdownTopY);
  }

  private drawModified = () => {
    if (!this.modified) {
      return;
    }

    if (this.modifiedTimeout) {
      clearTimeout(this.modifiedTimeout);
      this.modifiedTimeout = undefined;
    }

    const { timeAgo, nextInterval } = timeAgoAndNextTimeout(Number(this.table.codeCell.last_modified));

    if (nextInterval > 0) {
      this.modifiedTimeout = window.setTimeout(this.drawModified, nextInterval);
    }

    if (!timeAgo) {
      this.modified.visible = false;
      return;
    }

    if (timeAgo !== this.modified.text) {
      this.modified.text = timeAgo;
      if (
        !pixiApp.viewport.dirty &&
        pixiApp.viewport.getVisibleBounds().intersects(this.tableNameBounds) &&
        this.table.sheet.id === sheets.current
      ) {
        pixiApp.setViewportDirty();
      }
    }

    // don't show the modified text if it overlaps the left text
    if (
      this.dropdown.x + this.dropdown.width + TABLE_NAME_PADDING[0] + this.modified.width + SYMBOL_PADDING >
      this.table.tableBounds.width
    ) {
      this.modified.visible = false;
    } else {
      this.modified.visible = true;
      this.modified.anchor.set(0, 0.5);
      // Center vertically within the row height (modified anchor is at center)
      const rowCenterY = this.h / 2;
      this.modified.position.set(this.table.tableBounds.width - this.modified.width - SYMBOL_PADDING, rowCenterY);
    }
  };

  update = () => {
    this.h = this.table.sheet.offsets.getRowHeight(this.table.codeCell.y);
    this.tableNameBounds = new Rectangle(
      this.table.tableBounds.x,
      this.table.tableBounds.y,
      this.backgroundWidth,
      this.h
    );
    // Only update rotation if actually running (or if we need to reset it)
    const isRunning = this.table.running === true;
    if (isRunning || (this.symbol && this.symbol.rotation !== 0)) {
      this.updateSymbolRotation();
    }
    this.drawSymbol();
    this.drawText();
    this.drawDropdown();
    this.drawModified();
    if (this.table.active) {
      this.dropdown.visible = true;
    } else {
      this.dropdown.visible = false;
    }
    this.drawBackground();
  };

  intersects(world: Point): TablePointerDownResult | undefined {
    if (this.visible && intersects.rectanglePoint(this.tableNameBounds, world)) {
      if (world.x <= this.tableNameBounds.x + this.text.x + this.text.width + DROPDOWN_PADDING) {
        return { table: this.table.codeCell, type: 'table-name' };
      }
      if (
        this.table.active &&
        world.x <= this.tableNameBounds.x + this.text.x + this.text.width + this.dropdown.width + DROPDOWN_PADDING
      ) {
        return { table: this.table.codeCell, type: 'dropdown' };
      }
      return { table: this.table.codeCell, type: 'table-name' };
    }
    return undefined;
  }

  hide() {
    this.visible = false;
  }

  show() {
    this.visible = true;
  }

  get hidden(): boolean {
    return !this.visible;
  }

  toHover(y: number) {
    this.tableNameBounds.y = y;
  }

  toGrid() {
    this.tableNameBounds.y = this.table.tableBounds.y;
  }
}
