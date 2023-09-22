import { Container, Rectangle, Renderer } from 'pixi.js';
import { grid } from '../../../grid/controller/Grid';
import { Bounds } from '../../../grid/sheet/Bounds';
import { Sheet } from '../../../grid/sheet/Sheet';
import { JsRenderCell } from '../../../quadratic-core/types';
import { debugTimeCheck, debugTimeReset } from '../../helpers/debugPerformance';
import { CellsHash } from '../CellsHash';
import { CellHash } from '../CellsTypes';
import { CellLabel } from './CellLabel';
import { LabelMeshes } from './LabelMeshes';

// holds all CellLabels within a sheet
export class CellsLabels extends Container<LabelMeshes> implements CellHash {
  private cellsHash: CellsHash;

  // holds the meshes for font/style combinations
  private labelMeshes: LabelMeshes;

  cellLabels: Map<string, CellLabel>;

  // this is used by CellsHash
  hashes: Set<CellsHash>;
  AABB?: Rectangle;

  viewBounds: Bounds;

  constructor(cellsHash: CellsHash) {
    super();
    this.cellsHash = cellsHash;
    this.cellLabels = new Map();
    this.hashes = new Set();
    this.labelMeshes = this.addChild(new LabelMeshes());
    this.viewBounds = new Bounds();
  }

  get sheet(): Sheet {
    return this.cellsHash.sheet;
  }

  private getKey(cell: JsRenderCell): string {
    return `${cell.x},${cell.y}`;
  }

  create(): void {
    debugTimeReset();
    this.cellLabels = new Map();
    const cells = this.sheet.getRenderCells(this.cellsHash.AABB);
    cells.forEach((cell) => {
      const rectangle = grid.getCellOffsets(this.sheet.id, Number(cell.x), Number(cell.y));
      const cellLabel = new CellLabel(cell, rectangle);
      this.cellLabels.set(this.getKey(cell), cellLabel);
    });
    this.updateText();
    debugTimeCheck('cellsLabels');
  }

  render(renderer: Renderer) {
    if (!this.visible || this.worldAlpha <= 0 || !this.renderable) {
      return;
    }
    this.labelMeshes.render(renderer);
  }

  updateText(): void {
    this.labelMeshes.clear();

    // place glyphs and sets size of labelMeshes
    this.cellLabels.forEach((child) => child.updateText(this.labelMeshes));
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

  /** clips overflows for CellLabels */
  overflowClip(): void {
    const bounds = this.cellsHash.sheet.getGridBounds(true);

    // empty when there are no cells
    if (!bounds) return;

    this.cellLabels.forEach((cellLabel) => this.checkClip(bounds, cellLabel));
  }

  private checkClip(bounds: Rectangle, label: CellLabel): void {
    // if (label.location.x === 3 && label.location.y === 4) debugger;
    let column = label.location.x - 1;
    const row = label.location.y;
    let currentHash: CellsHash | undefined = this.cellsHash;
    while (column >= bounds.left) {
      if (column < this.cellsHash.AABB.x) {
        // find hash to the left of current hash (skip over empty hashes)
        currentHash = this.cellsHash.findPreviousHash(column, row, bounds);
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

  getLabel(column: number, row: number): CellLabel | undefined {
    return this.cellLabels.get(`${column},${row}`);
  }
}
