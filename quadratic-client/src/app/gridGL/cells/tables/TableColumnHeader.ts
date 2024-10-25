/* eslint-disable @typescript-eslint/no-unused-vars */
//! Holds a column header within a table.

import { Table } from '@/app/gridGL/cells/tables/Table';
import { TablePointerDownResult } from '@/app/gridGL/cells/tables/Tables';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { DataTableSort } from '@/app/quadratic-core-types';
import { FONT_SIZE, OPEN_SANS_FIX } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellLabel';
import { BitmapText, Container, Graphics, Point, Rectangle, Sprite, Texture } from 'pixi.js';

const SORT_BACKGROUND_ALPHA = 0.1;
const SORT_BUTTON_RADIUS = 7;
const SORT_ICON_SIZE = 12;
const SORT_BUTTON_PADDING = 3;

export class TableColumnHeader extends Container {
  private table: Table;
  private index: number;

  private columnName: BitmapText;
  private sortIcon?: Sprite;

  private sortButtonStart = 0;

  sortButton?: Graphics;
  columnHeaderBounds: Rectangle;
  w: number;
  h: number;

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
    onSortPressed: Function;
  }) {
    super();
    const { table, index, x, width, height, name, sort, onSortPressed } = options;
    this.table = table;
    this.index = index;
    this.onSortPressed = onSortPressed;
    this.columnHeaderBounds = new Rectangle(table.tableBounds.x + x, table.tableBounds.y, width, height);
    this.w = width;
    this.h = height;
    this.position.set(x, 0);

    const tint = getCSSVariableTint('table-column-header-foreground');
    this.columnName = this.addChild(
      new BitmapText(name, {
        fontName: 'OpenSans-Bold',
        fontSize: FONT_SIZE,
        tint,
      })
    );
    this.clipName(name, width);
    this.drawSortButton(width, height, sort);
    this.columnName.position.set(OPEN_SANS_FIX.x, OPEN_SANS_FIX.y);
  }

  // Called when the CodeCell is updated
  updateHeader(x: number, width: number, height: number, name: string, sort?: DataTableSort) {
    this.columnHeaderBounds = new Rectangle(this.table.tableBounds.x + x, this.table.tableBounds.y, width, height);
    this.w = width;
    this.h = height;
    this.position.set(x, 0);
    this.columnName.text = name;
    this.clipName(name, width);
    this.updateSortButton(width, height, sort);
  }

  // tests the width of the text and clips it if it is too wide
  private clipName(name: string, width: number) {
    let clippedName = name;
    while (clippedName.length > 0 && this.columnName.width + SORT_BUTTON_RADIUS * 2 + SORT_BUTTON_PADDING > width) {
      clippedName = clippedName.slice(0, -1);
      this.columnName.text = clippedName;
    }
  }

  private drawSortButton(width: number, height: number, sort?: DataTableSort) {
    this.sortButtonStart = this.columnHeaderBounds.right - SORT_BUTTON_RADIUS * 2 - SORT_BUTTON_PADDING * 2;
    this.sortButton = this.addChild(new Graphics());
    this.sortButton.beginFill(0, SORT_BACKGROUND_ALPHA);
    this.sortButton.drawCircle(0, 0, SORT_BUTTON_RADIUS);
    this.sortButton.endFill();
    this.sortButton.position.set(width - SORT_BUTTON_RADIUS - SORT_BUTTON_PADDING, height / 2);
    this.sortButton.visible = false;

    const texture = sort ? Texture.from(sort.direction === 'Descending' ? 'arrow-up' : 'arrow-down') : Texture.EMPTY;
    this.sortIcon = this.addChild(new Sprite(texture));
    this.sortIcon.anchor.set(0.5);
    this.sortIcon.position = this.sortButton.position;
    this.sortIcon.width = SORT_ICON_SIZE;
    this.sortIcon.scale.y = this.sortIcon.scale.x;
  }

  private updateSortButton(width: number, height: number, sort?: DataTableSort) {
    this.sortButtonStart = this.columnHeaderBounds.right - SORT_BUTTON_RADIUS - SORT_BUTTON_PADDING;
    if (!this.sortButton) {
      throw new Error('Expected sortButton to be defined in updateSortButton');
    }
    this.sortButton.position.set(width - SORT_BUTTON_RADIUS - SORT_BUTTON_PADDING, height / 2);
    if (!this.sortIcon) {
      throw new Error('Expected sortIcon to be defined in updateSortButton');
    }
    this.sortIcon.position = this.sortButton.position;
    this.sortIcon.texture = sort
      ? Texture.from(sort.direction === 'Descending' ? 'arrow-up' : 'arrow-down')
      : Texture.EMPTY;
    this.sortIcon.width = SORT_ICON_SIZE;
    this.sortIcon.scale.y = this.sortIcon.scale.x;
  }

  pointerMove(world: Point): boolean {
    if (!this.sortButton) return false;
    if (intersects.rectanglePoint(this.columnHeaderBounds, world)) {
      if (!this.sortButton.visible) {
        this.sortButton.visible = true;
        pixiApp.setViewportDirty();
      }
      this.tableCursor = world.x > this.sortButtonStart ? 'pointer' : undefined;
      return true;
    }
    if (this.sortButton.visible) {
      this.sortButton.visible = false;
      this.tableCursor = undefined;
      pixiApp.setViewportDirty();
    }
    this.tableCursor = undefined;
    return false;
  }

  pointerDown(world: Point): TablePointerDownResult | undefined {
    if (!this.sortButton) return;
    if (intersects.rectanglePoint(this.columnHeaderBounds, world)) {
      if (world.x > this.sortButtonStart) {
        this.onSortPressed();
        return { table: this.table.codeCell, type: 'sort' };
      } else {
        return { table: this.table.codeCell, type: 'column-name', column: this.index };
      }
    }
  }
}
