import { Rectangle } from 'pixi.js';
import { Sheet } from '../../../grid/sheet/Sheet';
import { CellsSheet } from '../CellsSheet';
import { CellsHashBounds, sheetHashHeight, sheetHashWidth } from '../CellsTypes';

// number of meshes to measure per frame (since MAXIMUM_FRAME_TIME is limited by the coarseness in performance.now())
const meshesPerFrame = 3;

// async populating of a CellsSheet
class CreateCellsSheet {
  private cellsSheet?: CellsSheet;
  private resolve?: () => void;
  private hashBounds?: CellsHashBounds;
  private x?: number;
  private y?: number;
  private timeout?: number;

  populate(cellsSheet: CellsSheet): Promise<void> {
    if (this.timeout) {
      window.clearTimeout(this.timeout);
    }
    return new Promise((resolve) => {
      this.cellsSheet = cellsSheet;
      const bounds = this.sheet.grid.getGridBounds(false);
      if (!bounds) {
        resolve();
        return;
      }
      this.hashBounds = cellsSheet.getHashBounds(bounds);
      this.resolve = resolve;
      this.x = this.hashBounds!.xStart;
      this.y = this.hashBounds!.yStart;
      this.nextHash();
    });
  }

  private get sheet(): Sheet {
    if (!this.cellsSheet) {
      throw new Error('Expected createCellsSheet.cellsSheet to be defined');
    }
    return this.cellsSheet.sheet;
  }

  private nextHash = (): void => {
    if (
      this.cellsSheet === undefined ||
      this.x === undefined ||
      this.y === undefined ||
      this.hashBounds === undefined
    ) {
      throw new Error('Expected variables to be defined in createCellsSheet.next');
    }
    for (let i = 0; i < meshesPerFrame; i++) {
      const rect = new Rectangle(
        this.x * sheetHashWidth,
        this.y * sheetHashHeight,
        sheetHashWidth - 1,
        sheetHashHeight - 1
      );
      const cells = this.sheet.grid.getCellList(rect);
      const background = this.sheet.grid.getCellBackground(rect);
      if (cells.length || background.length) {
        this.cellsSheet.addHash(this.x, this.y, cells, background);
      }
      this.x++;
      if (this.x > this.hashBounds.xEnd) {
        this.x = this.hashBounds.xStart;
        this.y++;

        // start clipping when we've populated all cellHashes
        if (this.y > this.hashBounds.yEnd) {
          this.timeout = window.setTimeout(this.clip);
          return;
        }
      }
    }
    this.timeout = window.setTimeout(this.nextHash);
  };

  private clip = () => {
    if (!this.cellsSheet) {
      throw new Error('Expected cellsSheet to be defined in createCellsSheet.clip');
    }
    this.cellsSheet.cellsHash.forEach((hash) => hash.overflowClip());
    this.timeout = window.setTimeout(this.updateText);
  };

  private updateText = () => {
    if (!this.cellsSheet) {
      throw new Error('Expected cellsSheet to be defined in createCellsSheet.updateText');
    }
    this.cellsSheet.cellsHash.forEach((hash) => hash.updateTextAfterClip());
    this.timeout = window.setTimeout(this.updateBuffers);
  };

  private updateBuffers = () => {
    if (!this.cellsSheet || !this.resolve) {
      throw new Error('Expected cellsSheet and resolve to be defined in createCellsSheet.updateBuffers');
    }
    this.cellsSheet.cellsHash.forEach((hash) => hash.updateBuffers());
    this.timeout = undefined;
    this.resolve();
  };
}

export const createCellsSheet = new CreateCellsSheet();
