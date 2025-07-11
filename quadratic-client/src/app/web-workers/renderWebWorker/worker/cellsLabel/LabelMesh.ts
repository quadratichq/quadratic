/**
 * LabelMesh is a container that holds a specific font/style combination of
 * text.
 *
 * Where needed there will be two LabelMesh objects for the same font/style: one
 * that includes color information, and one without color information because we
 * need to track color information per vertex, which can get moderately
 * expensive.
 */

import { LabelMeshEntry } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/LabelMeshEntry';
import { v4 as uuid } from 'uuid';

// experimental value (recommended to be maximum of 100,000, with x6 for each label)
const MAX_VERTICES = 15000;

export class LabelMesh {
  sheetId: string;
  hashX: number;
  hashY: number;

  textureUid: number;

  id: string;

  fontName: string;
  fontSize: number;
  hasColor: boolean;

  total = 1;
  memory = 0;

  private currentEntry = 0;
  private labelMeshEntries: LabelMeshEntry[] = [];

  constructor(options: {
    sheetId: string;
    hashX: number;
    hashY: number;
    textureUid: number;
    fontName: string;
    fontSize: number;
    color: boolean;
  }) {
    const { sheetId, hashX, hashY, textureUid, fontName, fontSize, color } = options;
    this.sheetId = sheetId;
    this.hashX = hashX;
    this.hashY = hashY;

    this.textureUid = textureUid;
    this.hasColor = color;

    this.id = uuid();
    this.fontName = fontName;
    this.fontSize = fontSize;
  }

  prepare(): void {
    this.currentEntry = 0;
    this.labelMeshEntries = [];
    let total = this.total;
    while (total > 0) {
      const size = total > MAX_VERTICES ? MAX_VERTICES : total;
      this.labelMeshEntries.push(new LabelMeshEntry(this, size));
      total -= size;
    }
  }

  getBuffer(): LabelMeshEntry {
    if (this.labelMeshEntries.length === 0) {
      throw new Error("Expected LabelMesh's children to be initialized");
    }
    const entry = this.labelMeshEntries[this.currentEntry];
    if (entry.index + 1 > MAX_VERTICES) {
      this.currentEntry++;

      // this should never happen
      if (this.currentEntry >= this.labelMeshEntries.length) {
        throw new Error('LabelMeshEntries out of bounds');
      }
    }
    return entry;
  }

  finalize(): void {
    this.labelMeshEntries.forEach((entry) => entry.finalize());
    this.memory = this.labelMeshEntries.reduce((acc, entry) => acc + entry.memory, 0);
  }
}
