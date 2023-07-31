import { Container } from 'pixi.js';
import { SheetRust } from '../../grid/sheet/SheetRust';
import { PixiApp } from '../pixiApp/PixiApp';
import { CellsSheet } from './CellsSheet';

export class CellsSheets extends Container<CellsSheet> {
  private app: PixiApp;

  constructor(app: PixiApp) {
    super();
    this.app = app;
  }

  create(): void {
    this.removeChildren();
    this.app.sheet_controller.sheets.forEach((sheet) => {
      this.addChild(new CellsSheet(sheet as SheetRust));
    });
    this.show(this.app.sheet_controller.sheet.id);
  }

  show(id: string): void {
    this.children.forEach((child) => (child.visible = child.sheet.id === id));
  }
}
