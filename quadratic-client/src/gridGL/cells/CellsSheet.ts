import { Container, Rectangle } from 'pixi.js';
import { Sheet } from '../../grid/sheet/Sheet';
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

  sheet: Sheet;

  constructor(sheet: Sheet) {
    super();
    this.sheet = sheet;
    this.cellsFills = this.addChild(new CellsFills(this));

    // may need to clean this up if we ever move to a SPA
    this.addChild(new CellsSearch(sheet));

    this.cellsLabels = this.addChild(new CellsLabels(this));
    this.cellsArray = this.addChild(new CellsArray(this));
    this.cellsBorders = this.addChild(new CellsBorders(this));
    this.cellsMarkers = this.addChild(new CellsMarkers());
    this.visible = false;
  }

  async preload(): Promise<void> {
    this.cellsFills.create();
    this.cellsBorders.create();
    this.cellsArray.create();
    // await this.cellsLabels.preload();
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

  showLabel(x: number, y: number, show: boolean) {
    this.cellsLabels.showLabel(x, y, show);
  }

  updateCellsArray() {
    this.cellsArray.create();
  }

  updateFill(): void {
    this.cellsFills.create();
  }

  // update(userIsActive: boolean): boolean {
  //   const update = this.cellsLabels.update(userIsActive);
  //   if (update === 'headings') {
  //     // todo: these can be much more efficient
  //     this.cellsFills.create();
  //     this.cellsArray.create();

  //     return true;
  //   }
  //   return update;
  // }
}
