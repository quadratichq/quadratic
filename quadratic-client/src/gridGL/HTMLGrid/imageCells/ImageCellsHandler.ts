import { grid } from '@/grid/controller/Grid';
import { sheets } from '@/grid/controller/Sheets';
import { JsImageOutput } from '@/quadratic-core/types';
import { pixiApp } from '../../pixiApp/PixiApp';
import { ImageCell } from './ImageCell';

class ImageCellsHandler {
  private cells: Set<ImageCell> = new Set();

  // used to attach the image-cells to react
  private div?: HTMLDivElement;

  private handleViewport = () => {
    const parent = this.getParent();
    const viewport = pixiApp.viewport;
    viewport.updateTransform();
    const worldTransform = viewport.worldTransform;
    parent.style.transform = `matrix(${worldTransform.a},${worldTransform.b},${worldTransform.c},${worldTransform.d},${worldTransform.tx},${worldTransform.ty})`;
  };

  attach(parent: HTMLDivElement) {
    if (this.div) {
      parent.appendChild(this.div);
    }
  }

  init(parent: HTMLDivElement | null) {
    this.div = this.div ?? document.createElement('div');
    this.div.className = 'image-cells';
    this.updateImageCells();
    this.handleViewport();
    pixiApp.viewport.on('moved', this.handleViewport);
    pixiApp.viewport.on('moved-end', this.handleViewport);
    pixiApp.viewport.on('zoomed', this.handleViewport);
    window.addEventListener('change-sheet', this.changeSheet);
    window.addEventListener('image-update', this.updateImageCellsBySheetId);
    if (parent) {
      this.attach(parent);
    }
  }

  destroy() {
    pixiApp.viewport.off('moved', this.handleViewport);
    pixiApp.viewport.off('moved-end', this.handleViewport);
    pixiApp.viewport.on('zoomed', this.handleViewport);
    window.removeEventListener('change-sheet', this.changeSheet);
    window.removeEventListener('image-update', this.updateImageCellsBySheetId);
  }

  private changeSheet = () => {
    this.cells.forEach((cell) => cell.changeSheet(sheets.sheet.id));
  };

  private getParent(): HTMLDivElement {
    if (!this.div) {
      throw new Error('Expected to find this.div in ImageCellsHandler.ts');
    }
    return this.div;
  }

  private prepareCells(old: ImageCell[], cells: JsImageOutput[]) {
    const parent = this.getParent();

    // update or add new cells
    cells.forEach((imageCell) => {
      const index = old.findIndex((cell) => cell.isOutputEqual(imageCell));
      if (index === -1) {
        const cell = new ImageCell(imageCell);
        parent.appendChild(cell.div);
        this.cells.add(cell);
      } else {
        old[index].update(imageCell);
        old.splice(index, 1);
      }
    });

    // remove old cells
    old.forEach((cell) => {
      parent.removeChild(cell.div);
      this.cells.delete(cell);
    });
  }

  private updateImageCellsBySheetId = (e: any) => {
    const old: ImageCell[] = [];
    const cells = e.detail.flatMap((sheet: { id: string }) => {
      old.push(...Array.from(this.cells.values()).filter((cell) => cell.isSheet(sheet.id)));
      return grid.getImageOutput(sheet.id);
    });
    this.prepareCells(old, cells);
  };

  private updateImageCells() {
    const cells = sheets.sheets.flatMap((sheet) => [...grid.getImageOutput(sheet.id)]);
    this.prepareCells([...this.cells], cells);
  }

  getCells(): ImageCell[] {
    return Array.from(this.cells.values());
  }

  updateOffsets(sheetIds: string[]) {
    this.cells.forEach((cell) => {
      if (sheetIds.includes(cell.sheet.id)) cell.updateOffsets();
    });
  }
}

export const imageCellsHandler = new ImageCellsHandler();
