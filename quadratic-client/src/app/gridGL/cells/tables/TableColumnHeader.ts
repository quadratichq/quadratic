//! Holds a column header within a table.

import { colors } from '@/app/theme/colors';
import { FONT_SIZE, OPEN_SANS_FIX } from '@/app/web-workers/renderWebWorker/worker/cellsLabel/CellLabel';
import { BitmapText, Container } from 'pixi.js';

export class TableColumnHeader extends Container {
  private text: BitmapText;

  columnHeaderBounds: { x0: number; x1: number };

  constructor(x: number, width: number, name: string) {
    super();
    this.columnHeaderBounds = { x0: x, x1: x + width };
    this.text = this.addChild(
      new BitmapText(name, {
        fontName: 'OpenSans-Bold',
        fontSize: FONT_SIZE,
        tint: colors.tableHeadingForeground,
      })
    );
    this.text.position.set(x + OPEN_SANS_FIX.x, OPEN_SANS_FIX.y);
  }
}
