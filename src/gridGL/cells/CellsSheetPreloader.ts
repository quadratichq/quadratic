import { debugTimeCheck, debugTimeReset } from '../helpers/debugPerformance';
import { CellsSheet } from './CellsSheet';
import { CellsTextHash } from './CellsTextHash';

const MAXIMUM_FRAME_TIME = 1000 / 15;

export class CellsSheetPreloader {
  private cellsSheet: CellsSheet;

  // hashes to createLabels()
  private hashesToCreate: CellsTextHash[] = [];

  // hashes to overflowClip() and updateBuffers()
  private hashesToLoad: CellsTextHash[] = [];

  // final promise return
  private resolve?: () => void;

  constructor(cellsSheet: CellsSheet) {
    this.cellsSheet = cellsSheet;
  }

  // preloads one row of hashes per tick
  private preloadTick = (time?: number): void => {
    if (!this.hashesToCreate.length && !this.hashesToLoad.length) {
      if (!this.resolve) throw new Error('Expected resolveTick to be defined in preloadTick');
      this.resolve();
    } else {
      time = time ?? performance.now();
      debugTimeReset();
      if (this.hashesToCreate.length) {
        const hash = this.hashesToCreate.pop()!;
        hash.createLabels();
      } else if (this.hashesToLoad.length) {
        const hash = this.hashesToLoad.pop()!;
        hash.overflowClip();
        hash.updateBuffers(false);
      }
      const now = performance.now();
      if (now - time < MAXIMUM_FRAME_TIME) {
        this.preloadTick(time);
      } else {
        debugTimeCheck('preloadTick', MAXIMUM_FRAME_TIME);
        setTimeout(this.preloadTick);
      }
    }
  };

  preload(): Promise<void> {
    return new Promise((resolve) => {
      this.cellsSheet.cellsFills.create();
      this.cellsSheet.cellsBorders.create();
      this.cellsSheet.cellsArray.create();

      if (!this.cellsSheet.createHashes()) {
        resolve();
      } else {
        this.resolve = resolve;
        this.hashesToCreate = Array.from(this.cellsSheet.cellsTextHash.values());
        this.hashesToLoad = Array.from(this.cellsSheet.cellsTextHash.values());
        this.preloadTick();
      }
    });
  }
}
