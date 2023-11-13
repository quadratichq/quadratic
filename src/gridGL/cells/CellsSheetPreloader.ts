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

  // preloads hashes by creating labels, and then overflow clipping and updating buffers
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
      if (performance.now() - time < MAXIMUM_FRAME_TIME) {
        this.preloadTick(time);
      } else {
        // we expect this to run longer than MINIMUM_FRAME_TIME
        debugTimeCheck('preloadTick', MAXIMUM_FRAME_TIME * 1.5);
        setTimeout(this.preloadTick);
      }
    }
  };

  preload(): Promise<void> {
    return new Promise((resolve) => {
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
