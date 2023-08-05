import { Container, Rectangle, Renderer, Texture } from 'pixi.js';
import { Bounds } from '../../../grid/sheet/Bounds';
import { Sheet } from '../../../grid/sheet/Sheet';
import { CellsHash } from '../CellsHash';
import { CellHash, CellRust } from '../CellsTypes';
import { CellLabel } from './CellLabel';
import { LabelMeshes } from './LabelMeshes';

// holds all CellLabels within a sheet
export class CellsLabels extends Container<LabelMeshes> implements CellHash {
  private cellsHash: CellsHash;
  private textureCache: Texture[] = [];

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
    this.cellLabels = new Map();
    cells = cells ?? this.sheet.grid.getCellList(this.cellsHash.AABB);
    const cellLabels = cells.map((cell) => {
      const rectangle = this.sheet.gridOffsets.getCell(cell.x, cell.y);
      const cellLabel = new CellLabel(this, cell, rectangle);
      this.cellLabels.set(this.getKey(cell), cellLabel);
      return cellLabel;
    });
    this.updateText();
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

    // creates labelMeshes webGL buffers based on size
    this.labelMeshes.prepare();

    // populate labelMeshes webGL buffers
    this.cellLabels.forEach((cellLabel) => cellLabel.updateLabelMesh(this.labelMeshes));

    // finalizes webGL buffers
    this.labelMeshes.finalize();
  }

  private getClipRight(label: CellLabel, textWidth: number): number | undefined {
    // const rightEnd = label.x + textWidth;
    // let column = label.data.location.x + 1;
    // const row = label.data.location.y;
    // let neighborOffset = this.sheet.gridOffsets.getCell(column, row).x;
    // while (neighborOffset < rightEnd) {
    //   const cell = this.sheet.grid.get(column, row)?.cell;
    //   if (cell?.value || (cell?.evaluation_result && cell?.evaluation_result?.success === false)) {
    //     return neighborOffset;
    //   }
    //   const neighborWidth = this.sheet.gridOffsets.getColumnWidth(column);
    //   neighborOffset += neighborWidth;
    //   column++;
    // }
    return;
  }

  private getClipLeft(label: CellLabel): number | undefined {
    // const leftEnd = label.x;
    // let column = label.data.location.x - 1;
    // const row = label.data.location.y;
    // let neighbor = this.app.sheet.gridOffsets.getCell(column, row);
    // let neighborWidth = neighbor.width;
    // let neighborOffset = neighbor.x + neighbor.width;
    // while (neighborOffset > leftEnd) {
    //   const cell = this.app.sheet.grid.get(column, row)?.cell;
    //   if (cell?.value || (cell?.evaluation_result && cell?.evaluation_result?.success === false)) {
    //     return neighborOffset;
    //   }
    //   neighborOffset -= neighborWidth;
    //   column--;
    //   neighborWidth = this.app.sheet.gridOffsets.getColumnWidth(column);
    // }
    return;
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
}
