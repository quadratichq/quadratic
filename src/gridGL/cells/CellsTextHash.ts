import { Container, Rectangle, Renderer } from 'pixi.js';
import { grid } from '../../grid/controller/Grid';
import { Bounds } from '../../grid/sheet/Bounds';
import { Sheet } from '../../grid/sheet/Sheet';
import { JsRenderCell } from '../../quadratic-core/types';
import { debugTimeCheck, debugTimeReset } from '../helpers/debugPerformance';
import { CellsSheet } from './CellsSheet';
import { sheetHashHeight, sheetHashWidth } from './CellsTypes';
import { CellLabel } from './cellsLabel/CellLabel';
import { LabelMeshes } from './cellsLabel/LabelMeshes';

// Draw hashed regions of cell glyphs (the text + text formatting)
export class CellsTextHash extends Container<LabelMeshes> {
  private cellsSheet: CellsSheet;

  // holds the glyph meshes for font/style combinations
  private labelMeshes: LabelMeshes;

  // index into the labels by location key (column,row)
  private cellLabels: Map<string, CellLabel>;

  hashX: number;
  hashY: number;

  // column/row bounds (does not include overflow cells)
  AABB: Rectangle;

  viewBounds: Bounds;

  dirty = false;

  constructor(cellsSheet: CellsSheet, x: number, y: number) {
    super();
    this.cellsSheet = cellsSheet;
    this.cellLabels = new Map();
    this.labelMeshes = this.addChild(new LabelMeshes());
    this.viewBounds = new Bounds();
    this.hashX = x;
    this.hashY = y;
    this.AABB = new Rectangle(x * sheetHashWidth, y * sheetHashHeight, sheetHashWidth - 1, sheetHashHeight - 1);
  }

  get sheet(): Sheet {
    return this.cellsSheet.sheet;
  }

  // key used to find individual cell labels
  private getKey(cell: JsRenderCell): string {
    return `${cell.x},${cell.y}`;
  }

  findPreviousHash(column: number, row: number, bounds?: Rectangle): CellsTextHash | undefined {
    return this.cellsSheet.findPreviousHash(column, row, bounds);
  }

  getLabel(column: number, row: number): CellLabel | undefined {
    return this.cellLabels.get(`${column},${row}`);
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

  // overrides container's render function
  render(renderer: Renderer) {
    if (!this.visible || this.worldAlpha <= 0 || !this.renderable) {
      return;
    }
    this.labelMeshes.render(renderer);
  }

  createLabels(): void {
    debugTimeReset();
    this.cellLabels = new Map();
    const cells = this.sheet.getRenderCells(this.AABB);
    cells.forEach((cell) => {
      const rectangle = grid.getCellOffsets(this.sheet.id, Number(cell.x), Number(cell.y));
      const cellLabel = new CellLabel(cell, rectangle);
      this.cellLabels.set(this.getKey(cell), cellLabel);
    });
    this.updateText();
    debugTimeCheck('cellsLabels');
  }

  private updateText() {
    this.labelMeshes.clear();

    // place glyphs and sets size of labelMeshes
    this.cellLabels.forEach((child) => child.updateText(this.labelMeshes));
  }

  overflowClip(): void {
    const bounds = this.sheet.getGridBounds(true);

    // empty when there are no cells
    if (!bounds) return;

    this.cellLabels.forEach((cellLabel) => this.checkClip(bounds, cellLabel));
  }

  private checkClip(bounds: Rectangle, label: CellLabel): void {
    // if (label.location.x === 3 && label.location.y === 4) debugger;
    let column = label.location.x - 1;
    const row = label.location.y;
    let currentHash: CellsTextHash | undefined = this;
    while (column >= bounds.left) {
      if (column < this.AABB.x) {
        // find hash to the left of current hash (skip over empty hashes)
        currentHash = this.findPreviousHash(column, row, bounds);
        if (!currentHash) return;
      }
      const neighborLabel = currentHash.getLabel(column, row);
      if (neighborLabel) {
        neighborLabel.checkRightClip(label.topLeft.x);
        label.checkLeftClip(neighborLabel.AABB.right);
        return;
      }
      column--;
    }
  }

  updateBuffers(): void {
    // creates labelMeshes webGL buffers based on size
    this.labelMeshes.prepare();

    // populate labelMeshes webGL buffers
    this.viewBounds.clear();
    this.cellLabels.forEach((cellLabel) => {
      const bounds = cellLabel.updateLabelMesh(this.labelMeshes);
      this.viewBounds.mergeInto(bounds);
    });

    // finalizes webGL buffers
    this.labelMeshes.finalize();
  }

  adjustHeadings(options: { column?: number; row?: number }): void {}
}
