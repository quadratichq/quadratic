//! Draws the grid lines for column headers when they are sticky.

import type { TableHeader } from '@/app/gridGL/cells/tables/TableHeader';
import { content } from '@/app/gridGL/pixiApp/Content';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { sharedEvents } from '@/shared/sharedEvents';
import { Graphics } from 'pixi.js';

export class TableColumnHeadersGridLines extends Graphics {
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
    if (content.gridLines.visible) {
      const tableLines = this.header.getColumnHeaderLines();
      if (!tableLines) return;
      const { y0, y1, lines } = tableLines;
      const currentLineStyle = content.gridLines.currentLineStyle;
      if (!currentLineStyle) return;

      lines.forEach((line, index) => {
        if (index === 0 || index === lines.length - 1) {
          this.lineStyle({
            color: getCSSVariableTint(this.header.table.active ? 'primary' : 'muted-foreground'),
            width: 1,
            alignment: index === lines.length - 1 ? 0 : 1,
          });
        } else {
          this.lineStyle(currentLineStyle);
        }

        this.moveTo(line, y0).lineTo(line, y1);
      });
      this.lineStyle(currentLineStyle);
      this.moveTo(lines[0], y0).lineTo(lines[lines.length - 1], y0);
      this.moveTo(lines[0], y1).lineTo(lines[lines.length - 1], y1);
    }
  };
}
