//! Draws the grid lines for column headers when they are sticky.

import type { TableHeader } from '@/app/gridGL/cells/tables/TableHeader';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { LineGraphics } from '@/app/gridGL/UI/LineGraphics';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { sharedEvents } from '@/shared/sharedEvents';

export class TableColumnHeadersGridLines extends LineGraphics {
  private header: TableHeader;

  constructor(header: TableHeader) {
    super();
    this.header = header;

    sharedEvents.on('changeThemeAccentColor', this.update);
  }

  destroy() {
    sharedEvents.off('changeThemeAccentColor', this.update);
    super.destroy();
  }

  update = () => {
    this.clear();
    if (pixiApp.gridLines.visible) {
      const tableLines = this.header.getColumnHeaderLines();
      if (!tableLines) return;
      const { y0, y1, lines } = tableLines;

      let tint = 0;
      let alignment = 0;
      lines.forEach((line, index) => {
        if (index === 0 || index === lines.length - 1) {
          tint = getCSSVariableTint(this.header.table.active ? 'primary' : 'muted-foreground');
          alignment = index === lines.length - 1 ? 0 : 1;
        } else {
          tint = 0;
          alignment = 0;
        }

        this.drawVerticalLine(y0, y1, line, { tint, alignment });
      });
      this.drawHorizontalLine(lines[0], lines[lines.length - 1], y0);
      this.drawHorizontalLine(lines[0], lines[lines.length - 1], y1);
    }
    this.alpha = pixiApp.gridLines.alpha;
    this.finish();
  };
}
