import { Container, Graphics, Rectangle, Renderer } from 'pixi.js';
import { Bounds } from '../../grid/sheet/Bounds';
import { Sheet } from '../../grid/sheet/Sheet';
import { JsRenderCell } from '../../quadratic-core/types';
import { pixiApp } from '../pixiApp/PixiApp';
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

  // rebuild CellsTextHash
  dirty = false;

  // rebuild only buffers
  dirtyBuffers = false;

  // color to use for drawDebugBox
  debugColor = Math.floor(Math.random() * 0xffffff);

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
  private getKey(cell: { x: bigint | number; y: bigint | number }): string {
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
    if (this.visible && this.worldAlpha > 0 && this.renderable) {
      this.labelMeshes.render(renderer);
    }
  }

  private createLabel(cell: JsRenderCell): CellLabel {
    const rectangle = this.sheet.getCellOffsets(Number(cell.x), Number(cell.y));
    const cellLabel = new CellLabel(cell, rectangle);
    this.cellLabels.set(this.getKey(cell), cellLabel);
    return cellLabel;
  }

  createLabels(): void {
    this.cellLabels = new Map();
    const cells = this.sheet.getRenderCells(this.AABB);
    cells.forEach((cell) => this.createLabel(cell));
    this.updateText();
  }

  update(): boolean {
    if (this.dirty) {
      this.createLabels();
      this.overflowClip();
      this.updateBuffers(false);
      this.dirty = false;
      this.dirtyBuffers = false;

      // we need to test visibility in case the bounds changed
      this.visible = this.viewBounds.intersectsRectangle(pixiApp.viewport.getVisibleBounds());

      return true;
    } else if (this.dirtyBuffers) {
      this.updateBuffers(true);
      this.dirtyBuffers = false;
      return true;
    }
    return false;
  }

  private updateText() {
    this.labelMeshes.clear();

    // place glyphs and sets size of labelMeshes
    this.cellLabels.forEach((child) => child.updateText(this.labelMeshes));
  }

  overflowClip(): void {
    // used to ensure we don't check for clipping beyond the end of the sheet's data bounds
    const bounds = this.sheet.getGridBounds(true);

    // empty when there are no cells
    if (!bounds) return;

    this.cellLabels.forEach((cellLabel) => this.checkClip(bounds, cellLabel));
  }

  private checkClip(bounds: Rectangle, label: CellLabel): void {
    let column = label.location.x - 1;
    const row = label.location.y;
    let currentHash: CellsTextHash | undefined = this;
    while (column >= bounds.left) {
      if (column < currentHash.AABB.x) {
        // find hash to the left of current hash (skip over empty hashes)
        currentHash = this.findPreviousHash(column, row, bounds);
        if (!currentHash) return;
      }
      const neighborLabel = currentHash.getLabel(column, row);
      if (neighborLabel) {
        neighborLabel.checkRightClip(label.AABB.left);
        label.checkLeftClip(neighborLabel.AABB.right);
        return;
      }
      column--;
    }
  }

  updateBuffers(reuseBuffers: boolean): void {
    // creates labelMeshes webGL buffers based on size
    this.labelMeshes.prepare(reuseBuffers);

    // populate labelMeshes webGL buffers
    this.viewBounds.clear();
    this.cellLabels.forEach((cellLabel) => {
      const bounds = cellLabel.updateLabelMesh(this.labelMeshes);
      this.viewBounds.mergeInto(bounds);
    });

    // finalizes webGL buffers
    this.labelMeshes.finalize();
  }

  adjustHeadings(options: { delta: number; column?: number; row?: number }): boolean {
    const { delta, column, row } = options;
    let changed = false;
    if (column !== undefined) {
      this.cellLabels.forEach((label) => {
        if (label.location.x === column) {
          label.adjustWidth(delta, column < 0);
        } else {
          if (column < 0) {
            if (label.location.x < column) {
              label.adjustX(-delta);
              changed = true;
            }
          } else {
            if (label.location.x > column) {
              label.adjustX(delta);
              changed = true;
            }
          }
        }
      });
    } else if (row !== undefined) {
      this.cellLabels.forEach((label) => {
        if (label.location.y === row) {
          label.adjustHeight(delta, row < 0);
        } else {
          if (row < 0) {
            if (label.location.y < row) {
              label.adjustY(-delta);
              changed = true;
            }
          } else {
            if (label.location.y > row) {
              label.adjustY(delta);
              changed = true;
            }
          }
        }
      });
    }
    return changed;
  }

  drawDebugBox(g: Graphics) {
    const screen = this.sheet.getScreenRectangle(this.AABB.left, this.AABB.top, this.AABB.width, this.AABB.height);
    g.beginFill(this.debugColor, 0.25);
    g.drawShape(screen);
    g.endFill();
  }

  getCellsContentMaxWidth(column: number): number {
    let max = 0;
    this.cellLabels.forEach((label) => {
      if (label.location.x === column) {
        max = Math.max(max, label.textWidth);
      }
    });
    return max;
  }

  showLabel(x: number, y: number, show: boolean) {
    const label = this.getLabel(x, y);
    if (label && label.visible !== show) {
      label.visible = show;
      this.dirtyBuffers = true;
    }
  }
}
