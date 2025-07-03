//! Cache of tables by x,y, name, and large tables.

import type { Table } from '@/app/gridGL/cells/tables/Table';

export class TablesCache {
  // cache of tables by x,y
  private xyIndex: Record<string, Table> = {};

  // todo: maybe replace this with a1_context info?
  // cache of table by name
  private nameIndex: Record<string, Table> = {};

  clear = () => {
    this.xyIndex = {};
    this.nameIndex = {};
  };

  getByXY = (x: number | bigint, y: number | bigint): Table | undefined => {
    return this.xyIndex[`${x},${y}`];
  };

  getByName = (name: string): Table | undefined => {
    return this.nameIndex[name];
  };

  remove = (table: Table) => {
    const key = `${table.codeCell.x},${table.codeCell.y}`;
    delete this.nameIndex[table.codeCell.name];
    delete this.xyIndex[key];
  };

  add = (table: Table) => {
    this.nameIndex[table.codeCell.name] = table;
    const key = `${table.codeCell.x},${table.codeCell.y}`;
    this.xyIndex[key] = table;
  };

  update = (table: Table) => {
    this.remove(table);
    this.add(table);
  };
}
