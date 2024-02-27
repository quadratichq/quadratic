import { sheets } from '@/grid/controller/Sheets';
import { Sheet } from '@/grid/sheet/Sheet';
import { SheetPos } from '@/quadratic-core-types';
import { colors } from '@/theme/colors';
import { Graphics } from 'pixi.js';
import { pixiApp } from '../pixiApp/PixiApp';

export class CellsSearch extends Graphics {
  private sheet: Sheet;

  constructor(sheet: Sheet) {
    super();
    this.sheet = sheet;
    window.addEventListener('search', this.handleSearch);
  }

  private handleSearch = (event: any) => {
    this.clear();
    if (event.detail) {
      event.detail.found.forEach((cell: SheetPos, index: number) => {
        const { x, y, sheet_id } = cell;
        if (this.sheet.id === sheet_id.id) {
          const offsets = this.sheet.getCellOffsets(Number(x), Number(y));
          this.beginFill(colors.searchCell, event.detail.current === index ? 1 : 0.1);
          this.drawRect(offsets.x, offsets.y, offsets.width, offsets.height);
          this.endFill();
        }
      });
    }
    if (sheets.sheet.id === this.sheet.id) {
      pixiApp.setViewportDirty();
    }
  };
}
