//! Holds a column header within a table.

import type { Table } from '@/app/gridGL/cells/tables/Table';
import type { TablePointerDownResult } from '@/app/gridGL/cells/tables/Tables';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import type { DataTableSort } from '@/app/quadratic-core-types';
import { LINE_HEIGHT, OPEN_SANS_FIX } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellLabel';
import { DEFAULT_FONT_SIZE, SORT_BUTTON_PADDING, SORT_BUTTON_RADIUS } from '@/shared/constants/gridConstants';
import type { Point } from 'pixi.js';
import { BitmapText, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';

const SORT_BACKGROUND_ALPHA = 0.1;
const SORT_ICON_SIZE = 12;
const SORT_BUTTON_TINT = 0x000000;
const SORT_BUTTON_DIRTY_TINT = 0xff0000;

export class TableColumnHeader extends Container {
  private table: Table;
  index: number;

  private columnName: BitmapText;
  private sortIcon?: Sprite;

  private sortButtonStart = 0;

  sortButton?: Graphics;
  columnHeaderBounds: Rectangle;
  w: number;
  h: number;

  private dirtySort: boolean;

  private onSortPressed: Function;

  tableCursor: string | undefined;

  constructor(options: {
    table: Table;
    index: number;
    x: number;
    width: number;
    height: number;
    name: string;
    sort?: DataTableSort;
    dirtySort: boolean;
    onSortPressed: Function;
    columnY: number;
  }) {
    super();
    const { table, index, x, width, height, name, sort, dirtySort, onSortPressed, columnY } = options;
    this.table = table;
    this.index = index;
    this.onSortPressed = onSortPressed;
    this.columnHeaderBounds = new Rectangle(table.tableBounds.x + x, table.tableBounds.y + columnY, width, height);
    this.w = width;
    this.h = height;
    this.dirtySort = dirtySort;
    this.position.set(x, 0);

    const tint = getCSSVariableTint('foreground');
    this.columnName = this.addChild(
      new BitmapText(name, {
        fontName: 'OpenSans-Bold',
        fontSize: DEFAULT_FONT_SIZE,
        tint,
      })
    );
    this.clipName(name, width);
    this.drawSortButton(width, height, sort);

    // Calculate available space for vertical positioning (use LINE_HEIGHT like CellLabel)
    const textHeight = LINE_HEIGHT;
    const availableSpace = this.h - textHeight;

    // Calculate vertical position
    const yPos = Math.max(0, availableSpace / 2);

    this.columnName.anchor.set(0, 0);
    this.columnName.position.set(OPEN_SANS_FIX.x, OPEN_SANS_FIX.y + yPos);
  }

  // tests the width of the text and clips it if it is too wide
  private clipName = (name: string, width: number) => {
    let clippedName = name;
    while (clippedName.length > 0 && this.columnName.width + SORT_BUTTON_RADIUS * 2 + SORT_BUTTON_PADDING > width) {
      clippedName = clippedName.slice(0, -1);
      this.columnName.text = clippedName + '…';
    }
  };

  private drawSortButton = (width: number, height: number, sort?: DataTableSort) => {
    this.sortButtonStart = this.columnHeaderBounds.right - SORT_BUTTON_RADIUS * 2 - SORT_BUTTON_PADDING * 2;
    this.sortButton = this.addChild(new Graphics());
    this.sortButton.beginFill(0xffffff, SORT_BACKGROUND_ALPHA);
    this.sortButton.drawCircle(0, 0, SORT_BUTTON_RADIUS);
    this.sortButton.endFill();
    this.sortButton.position.set(width - SORT_BUTTON_RADIUS - SORT_BUTTON_PADDING, height / 2);
    this.updateSortButtonVisibility(false);

    const texture = sort
      ? Texture.from(sort.direction === 'Descending' ? 'sort-descending' : 'sort-ascending')
      : Texture.EMPTY;
    this.sortIcon = this.addChild(new Sprite(texture));
    this.sortIcon.anchor.set(0.5);
    this.sortIcon.position = this.sortButton.position;
    this.sortIcon.width = SORT_ICON_SIZE;
    this.sortIcon.scale.y = this.sortIcon.scale.x;
  };

  updateSortButtonVisibility = (visible: boolean) => {
    if (!this.sortButton) {
      return;
    }

    this.sortButton.visible = visible || this.dirtySort;
    this.sortButton.tint = visible ? SORT_BUTTON_TINT : this.dirtySort ? SORT_BUTTON_DIRTY_TINT : SORT_BUTTON_TINT;
  };

  pointerMove = (world: Point): boolean => {
    if (!this.sortButton) return false;

    if (intersects.rectanglePoint(this.columnHeaderBounds, world)) {
      if (!this.sortButton.visible || this.sortButton.tint !== SORT_BUTTON_TINT) {
        this.updateSortButtonVisibility(true);
        pixiApp.setViewportDirty();
      }
      this.tableCursor = world.x > this.sortButtonStart ? 'pointer' : undefined;
      return true;
    }
    if (this.sortButton.visible) {
      this.updateSortButtonVisibility(false);
      this.tableCursor = undefined;
      pixiApp.setViewportDirty();
    }
    this.tableCursor = undefined;
    return false;
  };

  pointerDown = (world: Point): TablePointerDownResult | undefined => {
    if (!this.sortButton) return;
    if (intersects.rectanglePoint(this.columnHeaderBounds, world)) {
      if (world.x > this.sortButtonStart) {
        this.onSortPressed();
        return { table: this.table.codeCell, type: 'sort' };
      } else {
        return { table: this.table.codeCell, type: 'column-name', column: this.index };
      }
    }
  };

  toHoverGrid = (y: number) => {
    this.columnHeaderBounds.y = y;
  };
}
