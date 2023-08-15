import { BitmapFont } from 'pixi.js';
import { HEADING_SIZE } from '../../constants/gridConstants';
import { Sheet } from '../../grid/sheet/Sheet';
import { ensureVisible } from '../interaction/viewportHelper';
import { QuadrantChanged } from '../quadrants/Quadrants';
import { Coordinate } from '../types/size';
import { PixiApp } from './PixiApp';
import { PixiAppSettings } from './PixiAppSettings';

// this is a helper for the sheetController and react to communicate with PixiApp

export interface SetDirty {
  cursor?: boolean;
  headings?: boolean;
  gridLines?: boolean;
}

class PixiAppEvents {
  app?: PixiApp;

  getSettings(): PixiAppSettings {
    if (!this.app) throw new Error('Expected app to be defined in PixiAppEvents.settings');
    return this.app.settings;
  }

  quadrantsChanged(quadrantChanged: QuadrantChanged): void {
    if (!this.app) throw new Error('Expected app to be defined in PixiAppEvents.quadrantsChanged');

    // this.app.quadrants.quadrantChanged(quadrantChanged);
  }

  setDirty(dirty: SetDirty): void {
    if (!this.app) throw new Error('Expected app to be defined in PixiAppEvents.setDirty');

    if (dirty.cursor) {
      this.app.cursor.dirty = true;
    }
    if (dirty.headings) {
      this.app.headings.dirty = true;
    }
    if (dirty.gridLines) {
      this.app.gridLines.dirty = true;
    }
  }

  cursorPosition(): void {
    if (!this.app) throw new Error('Expected app to be defined in PixiAppEvents.cursorPosition');

    this.app.cursor.dirty = true;
    this.app.headings.dirty = true;

    ensureVisible({ app: this.app, sheet: this.app.sheet });

    // triggers useGetBorderMenu clearSelection()
    window.dispatchEvent(new CustomEvent('cursor-position'));
  }

  changeSheet(): void {
    if (!this.app) throw new Error('Expected app to be defined in PixiAppEvents.changeSheet');

    this.app.viewport.dirty = true;
    this.app.gridLines.dirty = true;
    this.app.axesLines.dirty = true;
    this.app.headings.dirty = true;
    this.app.cursor.dirty = true;
    // this.app.quadrants.changeSheet();
    this.app.boxCells.reset();
    this.app.settings.changeInput(false);
    this.app.cellsSheets.show(this.app.sheet.id);
  }

  addSheet(sheet: Sheet): void {
    if (!this.app) throw new Error('Expected app to be defined in PixiAppEvents.addSheet');
    this.app.cellsSheets.addSheet(sheet.id);
    // this.app.quadrants.addSheet(sheet);
  }

  quadrantsDelete(sheet: Sheet): void {
    if (!this.app) throw new Error('Expected app to be defined in PixiAppEvents.quadrantsDelete');

    // this.app.quadrants.deleteSheet(sheet);
  }

  async rebuild() {
    if (!this.app) throw new Error('Expected app to be defined in PixiAppEvents.rebuild');
    this.app.clear();
    this.app.viewport.dirty = true;
    this.app.gridLines.dirty = true;
    this.app.axesLines.dirty = true;
    this.app.headings.dirty = true;
    this.app.cursor.dirty = true;
    this.app.boxCells.reset();
    // this.app.quadrants.build();

    this.app.paused = true;
    // todo: hack!!! (this avoids loading the sheets during initial load b/c PIXI is not set up yet)
    if (BitmapFont.available['OpenSans']) {
      await this.loadSheets();
    }
    this.app.paused = false;
    this.app.reset();
  }

  setZoomState(zoom: number): void {
    if (!this.app) throw new Error('Expected app to be defined in PixiAppEvents.setZoomState');

    this.app.setZoomState(zoom);
  }

  setZoomTo(type: 'selection' | 'fit'): void {
    if (!this.app) throw new Error('Expected app to be defined in PixiAppEvents.setZoomTo');

    if (type === 'selection') {
      this.app.setZoomToSelection();
    } else if (type === 'fit') {
      this.app.setZoomToFit();
    }
  }

  changeInput(input: boolean, initialValue?: string): void {
    if (!this.app) throw new Error('Expected app to be defined in PixiAppEvents.changeInput');

    this.app.settings.changeInput(input, initialValue);
  }

  async loadSheets() {
    if (!this.app?.cellsSheets) throw new Error('Expected app.cellsSheets to be defined in PixiAppEvents.loadSheets');
    await this.app.cellsSheets.create();
    this.app.viewport.dirty = true;
  }

  async deleteSheet(sheetId: string) {
    if (!this.app?.cellsSheets) throw new Error('Expected app.cellsSheets to be defined in PixiAppEvents.deleteSheet');
    this.app.cellsSheets.deleteSheet(sheetId);
  }

  changed(options: {
    sheet: Sheet;
    cells?: Coordinate[];
    labels: boolean;
    background: boolean;
    column?: number;
    row?: number;
  }): void {
    if (!this.app?.cellsSheets) throw new Error('Expected app.cellsSheets to be defined in PixiAppEvents.changeCells');
    this.app.cellsSheets.changed(options);
    this.app.setViewportDirty();
  }

  getStartingViewport(): { x: number; y: number } {
    if (!this.app) throw new Error('Expected app to be defined in getStartingViewport');
    if (this.app.settings.showHeadings) {
      return { x: HEADING_SIZE, y: HEADING_SIZE };
    } else {
      return { x: 0, y: 0 };
    }
  }

  loadViewport(): void {
    if (!this.app) throw new Error('Expected app to be defined in saveViewport');
    const lastViewport = this.app.sheet.cursor.viewport;
    if (lastViewport) {
      this.app.viewport.position.set(lastViewport.x, lastViewport.y);
      this.app.viewport.scale.set(lastViewport.scaleX, lastViewport.scaleY);
      this.app.viewport.dirty = true;
    }
  }

  createBorders(): void {
    this.app?.cellsSheets.createBorders();
  }
}

export const pixiAppEvents = new PixiAppEvents();
