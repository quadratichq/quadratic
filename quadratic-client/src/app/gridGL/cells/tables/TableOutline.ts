import { Table } from '@/app/gridGL/cells/tables/Table';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { Graphics, Rectangle } from 'pixi.js';

export class TableOutline extends Graphics {
  private table: Table;

  constructor(table: Table) {
    super();
    this.table = table;
  }

  update() {
    this.clear();
    this.lineStyle({ color: getCSSVariableTint('primary'), width: 2, alignment: 0 });
    this.drawShape(new Rectangle(0, 0, this.table.tableBounds.width, this.table.tableBounds.height));
    this.visible = false;
  }
}
