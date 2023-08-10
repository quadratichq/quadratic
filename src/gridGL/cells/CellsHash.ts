import { Container, Graphics, Rectangle } from 'pixi.js';
import { debugShowCellsHashBoxes } from '../../debugFlags';
import { Bounds } from '../../grid/sheet/Bounds';
import { Sheet } from '../../grid/sheet/Sheet';
import { Pos, Rect } from '../../quadratic-core/quadratic_core';
import { CellsBackground } from './CellsBackground';
import { CellsSheet } from './CellsSheet';
import { CellFill, CellRust, sheetHashHeight, sheetHashWidth } from './CellsTypes';
import { CellLabel } from './cellsLabels/CellLabel';
import { CellsLabels } from './cellsLabels/CellsLabels';

export class CellsHash extends Container {
  cellsSheet: CellsSheet;

  private test?: Graphics;
  private cellsBackground: CellsBackground;
  cellsLabels: CellsLabels;

  hashX: number;
  hashY: number;

  // column/row bounds (does not include overflow cells)
  AABB: Rectangle;

  // x,y bounds (includes overflow cells)
  viewBounds: Bounds;

  // quadratic-core/rect
  rect: any;

  key: string;

  static getKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  dirty = false;

  constructor(cellsSheet: CellsSheet, x: number, y: number, options: { cells?: CellRust[]; background?: CellFill[] }) {
    super();
    this.cellsSheet = cellsSheet;
    this.hashX = x;
    this.hashY = y;
    this.key = CellsHash.getKey(x, y);
    this.AABB = new Rectangle(x * sheetHashWidth, y * sheetHashHeight, sheetHashWidth, sheetHashHeight);
    const screen = this.sheet.gridOffsets.getScreenRectangle(
      this.AABB.left,
      this.AABB.top,
      this.AABB.width,
      this.AABB.height
    );
    this.viewBounds = new Bounds();

    if (debugShowCellsHashBoxes) {
      this.test = this.addChild(new Graphics());
      this.test
        .beginFill(Math.floor(Math.random() * 0xffffff))
        .drawShape(screen)
        .endFill();
    }
    this.cellsBackground = this.addChild(new CellsBackground(this));
    this.cellsBackground.create(options.background);

    this.cellsLabels = this.addChild(new CellsLabels(this));
    this.cellsLabels.create(options.cells);
  }

  updateBounds() {
    this.viewBounds.clear();
    this.viewBounds.mergeInto(this.cellsLabels.viewBounds, this.cellsBackground.viewBounds);
  }

  get sheet(): Sheet {
    return this.cellsSheet.sheet;
  }

  findPreviousHash(column: number, row: number, bounds?: Rectangle): CellsHash | undefined {
    return this.cellsSheet.findPreviousHash(column, row, bounds);
  }

  getLabel(column: number, row: number): CellLabel | undefined {
    return this.cellsLabels.getLabel(column, row);
  }

  show(): void {
    if (!this.visible) {
      this.visible = true;
    }
  }

  hide(): void {
    if (this.visible) {
      this.visible = false;
    }
  }

  createLabels(): void {
    this.cellsLabels.create();
  }

  overflowClip(): void {
    this.cellsLabels.overflowClip();
  }

  updateTextAfterClip(): void {
    this.cellsLabels.updateTextAfterClip();
  }

  updateBuffers(): void {
    this.cellsLabels.updateBuffers();

    this.rect = new Rect(new Pos(this.AABB.left, this.AABB.top), new Pos(this.AABB.right, this.AABB.bottom));
    this.updateBounds();
  }

  updateBackgrounds(): void {
    this.cellsBackground.create();
  }
}
