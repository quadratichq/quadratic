import { Sheet } from '../../grid/sheet/Sheet';
import { QuadrantChanged } from '../quadrants/Quadrants';
import { PixiApp } from './PixiApp';

// this is a helper for the sheetController and react to communicate with PixiApp

export interface SetDirty {
  cells?: boolean;
  cursor?: boolean;
  headings?: boolean;
  gridLines?: boolean;
}

class PixiAppEvents {
  app?: PixiApp;

  quadrantsChanged(quadrantChanged: QuadrantChanged): void {
    if (!this.app) throw new Error('Expected app to be defined in PixiAppEvents.quadrantsChanged');

    this.app.quadrants.quadrantChanged(quadrantChanged);
    // this.app.cells.dirty = true;
  }

  setDirty(dirty: SetDirty): void {
    if (!this.app) throw new Error('Expected app to be defined in PixiAppEvents.setDirty');

    if (dirty.cells) {
      // this.app.cells.dirty = true;
    }
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
    // this.app.cells.dirty = true;
    this.app.quadrants.changeSheet();
    this.app.boxCells.reset();
    this.app.settings.changeInput(false);
  }

  addSheet(sheet: Sheet): void {
    if (!this.app) throw new Error('Expected app to be defined in PixiAppEvents.addSheet');

    this.app.quadrants.addSheet(sheet);
  }

  quadrantsDelete(sheet: Sheet): void {
    if (!this.app) throw new Error('Expected app to be defined in PixiAppEvents.quadrantsDelete');

    this.app.quadrants.deleteSheet(sheet);
  }

  rebuild(): void {
    if (!this.app) throw new Error('Expected app to be defined in PixiAppEvents.rebuild');

    this.app.viewport.dirty = true;
    this.app.gridLines.dirty = true;
    this.app.axesLines.dirty = true;
    this.app.headings.dirty = true;
    this.app.cursor.dirty = true;
    // this.app.cells.dirty = true;
    this.app.boxCells.reset();
    this.app.quadrants.build();
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

  loadSheets() {
    if (!this.app?.cellsSheets) throw new Error('Expected app.cellsSheets to be defined in PixiAppEvents.loadSheets');
    this.app?.cellsSheets.create();
  }
}

export const pixiAppEvents = new PixiAppEvents();
