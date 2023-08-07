import { Rectangle } from 'pixi.js';
import { Sheet } from '../../../grid/sheet/Sheet';
import { CellsSheet } from '../CellsSheet';
import { CellsHashBounds, sheetHashHeight, sheetHashWidth } from '../CellsTypes';

// async populating of a CellsSheet
class CreateCellsSheet {
  private cellsSheet?: CellsSheet;
  private resolve?: () => void;
  private hashBounds?: CellsHashBounds;
  private x?: number;
  private y?: number;

  populate(cellsSheet: CellsSheet): Promise<void> {
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
      if (this.y > this.hashBounds.yEnd) {
        setTimeout(this.clip, 0);
        return;
      }
    }
    setTimeout(this.nextHash, 0);
  };

  private clip = () => {
    if (!this.cellsSheet) {
      throw new Error('Expected cellsSheet to be defined in createCellsSheet.clip');
    }
    this.cellsSheet.cellsHash.forEach((hash) => hash.overflowClip());
    setTimeout(this.updateText, 0);
  };

  private updateText = () => {
    if (!this.cellsSheet) {
      throw new Error('Expected cellsSheet to be defined in createCellsSheet.updateText');
    }
    this.cellsSheet.cellsHash.forEach((hash) => hash.updateTextAfterClip());
    setTimeout(this.updateBuffers, 0);
  };

  private updateBuffers = () => {
    if (!this.cellsSheet || !this.resolve) {
      throw new Error('Expected cellsSheet and resolve to be defined in createCellsSheet.updateBuffers');
    }
    this.cellsSheet.cellsHash.forEach((hash) => hash.updateBuffers());
    this.resolve();
  };
}

export const createCellsSheet = new CreateCellsSheet();

// export const cellsSheetPopulate = (cellsSheet: CellsSheet): Promise<void> => {
//   return new Promise((resolve) => {
//     const sheet = cellsSheet.sheet;
//     const bounds = sheet.grid.getGridBounds(false);
//     if (bounds) {
//       const hashBounds = cellsSheet.getHashBounds(bounds);
//       for (let y = hashBounds.yStart; y <= hashBounds.yEnd; y++) {
//         for (let x = hashBounds.xStart; x <= hashBounds.xEnd; x++) {
//           const rect = new Rectangle(x * sheetHashWidth, y * sheetHashHeight, sheetHashWidth - 1, sheetHashHeight - 1);

//           const cells = sheet.grid.getCellList(rect);
//           const background = sheet.grid.getCellBackground(rect);
//           if (cells.length || background.length) {
//             this.addHash(x, y, cells, background);
//           }
//         }
//       }
//       this.cellsHash.forEach((hash) => hash.overflowClip());
//       this.cellsHash.forEach((hash) => hash.updateTextAfterClip());
//       this.cellsHash.forEach((hash) => hash.updateBuffers());
//     } else {
//       resolve();
//     }
//   });
// };
