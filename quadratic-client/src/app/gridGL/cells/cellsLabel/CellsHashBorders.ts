import { events } from '@/app/events/events';
import { Graphics } from 'pixi.js';

export class CellsHashBorders extends Graphics {
  private sheetId: string;
  private hashX: number;
  private hashY: number;

  constructor(sheetId: string, hashX: number, hashY: number) {
    super();
    this.sheetId = sheetId;
    this.hashX = hashX;
    this.hashY = hashY;
    events.on('bordersHash', (borders) => {
      if (borders.sheetId === this.cellsSheet.sheetId) {
        this.borders = borders;
        this.draw();
      }
    });
  }
}
