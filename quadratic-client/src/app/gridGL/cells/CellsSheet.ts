import { events } from '@/app/events/events';
import { Borders } from '@/app/gridGL/cells/Borders';
import { CellsFills } from '@/app/gridGL/cells/CellsFills';
import type { CellsImage } from '@/app/gridGL/cells/cellsImages/CellsImage';
import { CellsImages } from '@/app/gridGL/cells/cellsImages/CellsImages';
import { CellsLabels } from '@/app/gridGL/cells/cellsLabel/CellsLabels';
import { CellsMarkers } from '@/app/gridGL/cells/CellsMarkers';
import { CellsSearch } from '@/app/gridGL/cells/CellsSearch';
import { Tables } from '@/app/gridGL/cells/tables/Tables';
import type { JsHashValidationWarnings } from '@/app/quadratic-core-types';
import { renderWebWorker } from '@/app/web-workers/renderWebWorker/renderWebWorker';
import type { Rectangle, Sprite } from 'pixi.js';
import { Container } from 'pixi.js';

export interface ErrorMarker {
  triangle?: Sprite;
  symbol?: Sprite;
}

export interface ErrorValidation {
  x: number;
  y: number;
  validationId: string;
  value?: string;
}

export class CellsSheet extends Container {
  private borders: Borders;
  cellsFills: CellsFills;
  cellsImages: CellsImages;

  cellsMarkers: CellsMarkers;
  cellsLabels: CellsLabels;

  tables: Tables;

  sheetId: string;

  constructor(sheetId: string) {
    super();
    this.sheetId = sheetId;
    this.cellsFills = this.addChild(new CellsFills(this));

    // may need to clean this up if we ever move to a SPA
    this.addChild(new CellsSearch(sheetId));

    this.cellsLabels = this.addChild(new CellsLabels(this));
    this.cellsImages = this.addChild(new CellsImages(this));
    this.tables = this.addChild(new Tables(this));

    this.borders = this.addChild(new Borders(this));
    this.cellsMarkers = this.addChild(new CellsMarkers());
    this.visible = false;

    events.on('validationWarnings', this.renderValidations);
  }

  destroy() {
    events.off('validationWarnings', this.renderValidations);
    super.destroy({ children: true });
  }

  // used to render all cellsTextHashes to warm up the GPU
  showAll() {
    this.visible = true;
    this.cellsLabels.showAll();
  }

  show(bounds: Rectangle): void {
    this.visible = true;
    this.cellsLabels.show(bounds);
    this.cellsFills.cheapCull(bounds);
    this.cellsImages.cheapCull(bounds);
  }

  hide(): void {
    this.visible = false;
  }

  toggleOutlines(off?: boolean) {
    this.cellsMarkers.visible = off ?? true;
    this.tables.toggleOutlines();
  }

  showLabel(x: number, y: number, show: boolean) {
    renderWebWorker.showLabel(this.sheetId, x, y, show);
  }

  unload(hashX: number, hashY: number) {
    this.cellsLabels.unload(hashX, hashY);
  }

  adjustOffsets() {
    this.tables.sheetOffsets(this.sheetId);
  }

  getCellsImages(): CellsImage[] {
    return this.cellsImages.children;
  }

  update(dirtyViewport: boolean) {
    this.cellsFills.update();
    this.borders.update();
    this.tables.update(dirtyViewport);
  }

  private renderValidations = (warnings: JsHashValidationWarnings[]) => {
    warnings
      .filter((warning) => warning.sheet_id.id === this.sheetId)
      .forEach(({ hash, warnings }) => {
        if (!hash) {
          this.cellsLabels.renderValidationUpdates(warnings);
        } else {
          this.cellsLabels.renderValidations(hash, warnings);
        }
      });
  };

  getErrorMarker(x: number, y: number): ErrorMarker | undefined {
    return this.cellsMarkers.getErrorMarker(x, y) || this.cellsLabels.getErrorMarker(x, y);
  }

  getErrorMarkerValidation(x: number, y: number): boolean {
    return this.cellsLabels.getErrorMarker(x, y) !== undefined;
  }
}
