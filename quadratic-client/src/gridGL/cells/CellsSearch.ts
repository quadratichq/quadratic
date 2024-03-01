import { sheets } from '@/grid/controller/Sheets';
import { SheetPos } from '@/quadratic-core-types';
import { colors } from '@/theme/colors';
import { Graphics } from 'pixi.js';
import { pixiApp } from '../pixiApp/PixiApp';

export class CellsSearch extends Graphics {
  private sheetId: string;

  constructor(sheetId: string) {
    super();
    this.sheetId = sheetId;
    window.addEventListener('search', this.handleSearch);
  }

  private handleSearch = (event: any) => {
    this.clear();
    if (event.detail) {
      event.detail.found.forEach((cell: SheetPos, index: number) => {
        const { x, y, sheet_id } = cell;
        if (this.sheetId === sheet_id.id) {
          const sheet = sheets.getById(sheet_id.id);
          if (!sheet) throw new Error('Expected sheet to be defined in CellsSearch.handleSearch');
          const offsets = sheet.getCellOffsets(Number(x), Number(y));
          this.beginFill(colors.searchCell, event.detail.current === index ? 1 : 0.1);
          this.drawRect(offsets.x, offsets.y, offsets.width, offsets.height);
          this.endFill();
        }
      });
    }
    if (sheets.sheet.id === this.sheetId) {
      pixiApp.setViewportDirty();
    }
  };
}
