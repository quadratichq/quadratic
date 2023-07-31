import { Container } from 'pixi.js';
import { SheetRust } from '../../grid/sheet/SheetRust';
import { CellsSheet } from './CellsSheet';

export class CellsSheets extends Container<CellsSheet> {
  create(sheets: SheetRust[]): void {
    this.removeChildren();
    sheets.forEach((sheet) => {
      this.addChild(new CellsSheet(sheet));
    });
    this.show(sheets[0].id);
  }

  show(id: string): void {
    this.children.forEach((child) => (child.visible = child.sheet.id === id));
  }
}
