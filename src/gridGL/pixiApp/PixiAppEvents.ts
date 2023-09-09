import { BitmapFont, Rectangle } from 'pixi.js';
import { HEADING_SIZE } from '../../constants/gridConstants';
import { sheetController } from '../../grid/controller/SheetController';
import { Sheet } from '../../grid/sheet/Sheet';
import { SheetId } from '../../quadratic-core/types';
import { ensureVisible } from '../interaction/viewportHelper';
import { QuadrantChanged } from '../quadrants/Quadrants';
import { pixiApp } from './PixiApp';
import { PixiAppSettings } from './PixiAppSettings';

// this is a helper for the sheetController and react to communicate with PixiApp

export interface SetDirty {
  cursor?: boolean;
  headings?: boolean;
  gridLines?: boolean;
}

// todo: with pixiApp a singleton, this can be removed

class PixiAppEvents {
  getSettings(): PixiAppSettings {
    return pixiApp.settings;
  }

  quadrantsChanged(quadrantChanged: QuadrantChanged): void {
    // pixiApp.quadrants.quadrantChanged(quadrantChanged);
  }

  setDirty(dirty: SetDirty): void {
    if (dirty.cursor) {
      pixiApp.cursor.dirty = true;
    }
    if (dirty.headings) {
      pixiApp.headings.dirty = true;
    }
    if (dirty.gridLines) {
      pixiApp.gridLines.dirty = true;
    }
  }

  cursorPosition(): void {
    pixiApp.cursor.dirty = true;
    pixiApp.headings.dirty = true;

    ensureVisible();

    // triggers useGetBorderMenu clearSelection()
    window.dispatchEvent(new CustomEvent('cursor-position'));
  }

  changeSheet(): void {
    if (!pixiApp) throw new Error('Expected app to be defined in PixiAppEvents.changeSheet');

    pixiApp.viewport.dirty = true;
    pixiApp.gridLines.dirty = true;
    pixiApp.axesLines.dirty = true;
    pixiApp.headings.dirty = true;
    pixiApp.cursor.dirty = true;
    // pixiApp.quadrants.changeSheet();
    pixiApp.boxCells.reset();
    pixiApp.settings.changeInput(false);
    pixiApp.cellsSheets.show(sheetController.sheet.id);
  }

  addSheet(sheet: Sheet): void {
    // todo: hack!!! (this avoids loading the sheets during initial load b/c PIXI is not set up yet)
    if (BitmapFont.available['OpenSans']) {
      pixiApp.cellsSheets.addSheet(sheet.id);
    }
    // pixiApp.quadrants.addSheet(sheet);
  }

  quadrantsDelete(sheet: Sheet): void {
    // pixiApp.quadrants.deleteSheet(sheet);
  }

  async rebuild() {}

  changeInput(input: boolean, initialValue?: string): void {
    pixiApp.settings.changeInput(input, initialValue);
  }

  async loadSheets() {
    await pixiApp.cellsSheets.create();
    pixiApp.viewport.dirty = true;
  }

  async deleteSheet(sheetId: string) {
    pixiApp.cellsSheets.deleteSheet(sheetId);
  }

  getStartingViewport(): { x: number; y: number } {
    if (pixiApp.settings.showHeadings) {
      return { x: HEADING_SIZE, y: HEADING_SIZE };
    } else {
      return { x: 0, y: 0 };
    }
  }

  loadViewport(): void {
    const lastViewport = sheetController.sheet.cursor.viewport;
    if (lastViewport) {
      pixiApp.viewport.position.set(lastViewport.x, lastViewport.y);
      pixiApp.viewport.scale.set(lastViewport.scaleX, lastViewport.scaleY);
      pixiApp.viewport.dirty = true;
    }
  }

  setViewportDirty(): void {
    pixiApp.setViewportDirty();
  }

  createBorders(): void {
    pixiApp.cellsSheets.createBorders();
  }

  cellsChanged(sheetId: string, rectangle: Rectangle): void {
    pixiApp.cellsSheets.changed({ sheetId, rectangle, labels: true, background: false });
    pixiApp.setViewportDirty();
  }

  fillsChanged(sheetIds: SheetId[]): void {
    pixiApp.cellsSheets.updateFills(sheetIds);
  }
}

export const pixiAppEvents = new PixiAppEvents();
