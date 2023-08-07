import { Container, Rectangle, Renderer } from 'pixi.js';
import { Bounds } from '../../../grid/sheet/Bounds';
import { Sheet } from '../../../grid/sheet/Sheet';
import { debugTimeCheck, debugTimeReset } from '../../helpers/debugPerformance';
import { CellsHash } from '../CellsHash';
import { CellHash, CellRust } from '../CellsTypes';
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

  constructor(cellsHash: CellsHash) {
    super();
    this.cellsHash = cellsHash;
    this.cellLabels = new Map();
    this.hashes = new Set();
    this.labelMeshes = this.addChild(new LabelMeshes());
  }

  get sheet(): Sheet {
    return this.cellsHash.sheet;
  }

  private getKey(cell: CellRust): string {
    return `${cell.x},${cell.y}`;
  }

  create(cells?: CellRust[]): CellLabel[] {
    debugTimeReset();
    this.cellLabels = new Map();
    cells = cells ?? this.sheet.grid.getCellList(this.cellsHash.AABB);
    const cellLabels = cells.map((cell) => {
      const rectangle = this.sheet.gridOffsets.getCell(cell.x, cell.y);
      const cellLabel = new CellLabel(this, cell, rectangle);
      this.cellLabels.set(this.getKey(cell), cellLabel);
      return cellLabel;
    });
    this.updateText();
    debugTimeCheck('cellsLabel');
    return cellLabels;
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

  updateTextAfterClip(): void {
    this.cellLabels.forEach((child) => child.updateText(this.labelMeshes));
  }

  updateBuffers(): void {
    // creates labelMeshes webGL buffers based on size
    this.labelMeshes.prepare();

    // populate labelMeshes webGL buffers
    this.cellLabels.forEach((cellLabel) => cellLabel.updateLabelMesh(this.labelMeshes));

    // finalizes webGL buffers
    this.labelMeshes.finalize();
  }

  /** clips overflows for CellLabels */
  overflowClip(): void {
    const bounds = this.cellsHash.sheet.grid.getSheetBounds(true);
    if (!bounds) {
      throw new Error('Expected bounds to exist in overflowClip for CellsLabels');
    }
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
      //   const cell = this.app.sheet.grid.get(column, row)?.cell;
      //   if (cell?.value || (cell?.evaluation_result && cell?.evaluation_result?.success === false)) {
      //     return neighborOffset;
      //   }
      //   neighborOffset -= neighborWidth;
      //   column--;
      //   neighborWidth = this.app.sheet.gridOffsets.getColumnWidth(column);
      // }
    }
  }

  // checks to see if the label needs to be clipped based on other labels
  private checkForClipping(label: CellLabel): void {
    // const data = label.data;
    // if (!data) {
    //   throw new Error('Expected label.data to be defined in checkForClipping');
    // }
    // const textWidth = label.getFullTextWidth();
    // if (textWidth > data.expectedWidth) {
    //   let clipLeft: number | undefined, clipRight: number | undefined;
    //   if (data.alignment === 'right') {
    //     clipLeft = this.getClipLeft(label);
    //   } else if (data.alignment === 'center') {
    //     clipLeft = this.getClipLeft(label);
    //     clipRight = this.getClipRight(label, textWidth);
    //   } else {
    //     clipRight = this.getClipRight(label, textWidth);
    //   }
    //   label.setClip({ clipLeft, clipRight });
    // } else {
    //   label.setClip();
    // }
  }

  private checkForOverflow(options: { label: CellLabel; bounds: Bounds }): void {
    // const { label, bounds } = options;
    // const { data } = label;
    // const { alignment } = data;
    // // track overflowed widths
    // const width = label.textWidth;
    // if (width > data.expectedWidth) {
    //   if (alignment === 'left' && !label.clipRight) {
    //     label.overflowRight = width - data.expectedWidth;
    //     label.overflowLeft = undefined;
    //   } else if (alignment === 'right' && !label.clipLeft) {
    //     label.overflowLeft = width - data.expectedWidth;
    //     label.overflowRight = undefined;
    //   } else if (alignment === 'center') {
    //     const overflow = (width - data.expectedWidth) / 2;
    //     if (!label.clipLeft) {
    //       label.overflowLeft = overflow;
    //     }
    //     if (!label.clipRight) {
    //       label.overflowRight = overflow;
    //     }
    //   }
    // } else {
    //   label.overflowRight = undefined;
    //   label.overflowLeft = undefined;
    // }
    // bounds.addRectangle(new Rectangle(label.x, label.y, width, label.height));
  }

  getLabel(column: number, row: number): CellLabel | undefined {
    return this.cellLabels.get(`${column},${row}`);
  }
}
