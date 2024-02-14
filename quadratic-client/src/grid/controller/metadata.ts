import initMetadata, { SheetOffsets, SheetOffsetsWasm } from '@/quadratic-grid-metadata/quadratic_grid_metadata';
import { GridMetadata } from '@/web-workers/quadraticCore/coreClientMessages';

class Metadata {
  sheetIds: string[] = [];
  offsets: Map<string, SheetOffsets>;
  sheetInfo: Map<string, { name: string; order: string; color?: string }> = new Map();
  private undo: boolean = false;
  private redo: boolean = false;

  constructor() {
    this.offsets = new Map<string, SheetOffsets>();
  }

  async init() {
    await initMetadata();
  }

  async load(metadata: GridMetadata) {
    this.offsets.clear();
    for (const sheetId in metadata.sheets) {
      this.offsets.set(sheetId, SheetOffsetsWasm.load(metadata.sheets[sheetId].offsets));
    }
    this.sheetIds = Object.keys(metadata.sheets);
    this.sheetInfo.clear();
    for (const sheetId in metadata.sheets) {
      this.sheetInfo.set(sheetId, {
        name: metadata.sheets[sheetId].name,
        order: metadata.sheets[sheetId].order,
        color: metadata.sheets[sheetId].color,
      });
    }
    this.undo = metadata.undo;
    this.redo = metadata.redo;
  }

  hasUndo(): boolean {
    return this.undo;
  }

  hasRedo(): boolean {
    return this.redo;
  }
}

export const metadata = new Metadata();
