import { Container, Graphics, Rectangle } from 'pixi.js';
import { debugShowCellsHashBoxes } from '../../debugFlags';
import { grid } from '../../grid/controller/Grid';
import { Bounds } from '../../grid/sheet/Bounds';
import { Sheet } from '../../grid/sheet/Sheet';
import { Pos, Rect } from '../../quadratic-core/quadratic_core';
import { CellsSheet } from './CellsSheet';
import { sheetHashHeight, sheetHashWidth } from './CellsTypes';
import { CellLabel } from './cellsLabels/CellLabel';
import { CellsLabels } from './cellsLabels/CellsLabels';

export class CellsHash extends Container {
  cellsSheet: CellsSheet;

  private test?: Graphics;
  // private cellsBackground: CellsFills;
  private cellsLabels: CellsLabels;

  hashX: number;
  hashY: number;

  // column/row bounds (does not include overflow cells)
  AABB: Rectangle;

  // quadratic-core/rect
  rect: any;

  key: string;

  static getKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  dirty = false;

  static times = { updateText: 0, overflowClip: 0, updateTextAfterClip: 0 };

  constructor(cellsSheet: CellsSheet, x: number, y: number) {
    super();
    this.cellsSheet = cellsSheet;
    this.hashX = x;
    this.hashY = y;
    this.key = CellsHash.getKey(x, y);
    this.AABB = new Rectangle(x * sheetHashWidth, y * sheetHashHeight, sheetHashWidth - 1, sheetHashHeight - 1);

    if (debugShowCellsHashBoxes) {
      const screen = grid.getScreenRectangle(
        this.sheet.id,
        this.AABB.left,
        this.AABB.top,
        this.AABB.width,
        this.AABB.height
      );
      this.test = this.addChild(new Graphics());
      this.test
        .beginFill(Math.floor(Math.random() * 0xffffff))
        .drawShape(screen)
        .endFill();
    }
    // this.cellsBackground = this.addChild(new CellsFills(this));
    this.cellsLabels = this.addChild(new CellsLabels(this));
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

  updateBuffers(): void {
    this.cellsLabels.updateBuffers();

    this.rect = new Rect(new Pos(this.AABB.left, this.AABB.top), new Pos(this.AABB.right, this.AABB.bottom));
  }

  get viewBounds(): Bounds {
    return this.cellsLabels.viewBounds;
  }
}
