import { Container } from 'pixi.js';
import type { Rectangle } from 'pixi.js';

import { CellsArray } from '@/app/gridGL/cells/CellsArray';
import { CellsBorders } from '@/app/gridGL/cells/CellsBorders';
import { CellsFills } from '@/app/gridGL/cells/CellsFills';
import type { CellsImage } from '@/app/gridGL/cells/cellsImages/CellsImage';
import { CellsImages } from '@/app/gridGL/cells/cellsImages/CellsImages';
import { CellsLabels } from '@/app/gridGL/cells/cellsLabel/CellsLabels';
import { CellsMarkers } from '@/app/gridGL/cells/CellsMarkers';
import { CellsSearch } from '@/app/gridGL/cells/CellsSearch';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { renderWebWorker } from '@/app/web-workers/renderWebWorker/renderWebWorker';

export class CellsSheet extends Container {
  private cellsFills: CellsFills;
  private cellsBorders: CellsBorders;
  cellsArray: CellsArray;
  cellsImages: CellsImages;

  cellsMarkers: CellsMarkers;
  cellsLabels: CellsLabels;

  sheetId: string;

  constructor(sheetId: string) {
    super();
    this.sheetId = sheetId;
    this.cellsFills = this.addChild(new CellsFills(this));

    // may need to clean this up if we ever move to a SPA
    this.addChild(new CellsSearch(sheetId));

    this.cellsLabels = this.addChild(new CellsLabels(this));
    this.cellsArray = this.addChild(new CellsArray(this));
    this.cellsBorders = this.addChild(new CellsBorders(this));
    this.cellsMarkers = this.addChild(new CellsMarkers());
    this.cellsImages = new CellsImages(this);
    this.visible = false;
  }

  // used to render all cellsTextHashes to warm up the GPU
  showAll() {
    this.visible = true;
    this.cellsLabels.showAll();
  }

  show(bounds: Rectangle): void {
    this.visible = true;
    this.cellsLabels.show(bounds);
    this.cellsArray.visible = true;
    this.cellsArray.cheapCull(bounds);
    this.cellsFills.cheapCull(bounds);
    this.cellsImages.cheapCull(bounds);
    pixiApp.changeCellImages(this.cellsImages);
  }

  hide(): void {
    this.visible = false;
  }

  toggleOutlines(off?: boolean) {
    this.cellsArray.visible = off ?? true;
    this.cellsMarkers.visible = off ?? true;
  }

  showLabel(x: number, y: number, show: boolean) {
    renderWebWorker.showLabel(this.sheetId, x, y, show);
  }

  unload(hashX: number, hashY: number) {
    this.cellsLabels.unload(hashX, hashY);
  }

  adjustOffsets() {
    this.cellsBorders.draw();
  }

  updateCellsArray() {
    this.cellsArray.updateCellsArray();
  }

  getCellsImages(): CellsImage[] {
    return this.cellsImages.children;
  }

  update() {
    this.cellsFills.update();
  }
}
