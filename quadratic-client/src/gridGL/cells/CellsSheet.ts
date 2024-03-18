import { JsRenderFill } from '@/quadratic-core-types';
import { Container, Rectangle } from 'pixi.js';
import { CellsArray } from './CellsArray';
import { CellsBorders } from './CellsBorders';
import { CellsFills } from './CellsFills';
import { CellsMarkers } from './CellsMarkers';
import { CellsSearch } from './CellsSearch';
import { CellsLabels } from './cellsLabel/CellsLabels';

export class CellsSheet extends Container {
  private cellsFills: CellsFills;
  private cellsArray: CellsArray;
  private cellsBorders: CellsBorders;

  // friend of CellsSheetPreloader
  cellsLabels: CellsLabels;

  // friend of CellsArray
  cellsMarkers: CellsMarkers;

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
  }

  hide(): void {
    this.visible = false;
  }

  toggleOutlines(off?: boolean) {
    this.cellsArray.visible = off ?? true;
    this.cellsMarkers.visible = off ?? true;
  }

  createBorders() {
    this.cellsBorders.create();
  }

  // todo...
  showLabel(x: number, y: number, show: boolean) {
    // this.cellsLabels.showLabel(x, y, show);
  }

  updateFills(sheetFills: JsRenderFill[]) {
    this.cellsFills.create(sheetFills);
  }

  updateCellsArray() {
    this.cellsArray.create();
  }

  unload(hashX: number, hashY: number) {
    this.cellsLabels.unload(hashX, hashY);
  }
}
