//! This tracks any special cells that will be rendered by the client. This
//! includes checkboxes and dropdown indicators.

export interface RenderSpecial {
  checkboxes: RenderCheckbox[];
  dropdowns: RenderDropdown[];
}

export interface RenderCheckbox {
  column: number;
  row: number;

  // this is the center of the cell that the checkbox will be rendered in
  x: number;
  y: number;
  value: boolean;
}

export interface RenderDropdown {
  column: number;
  row: number;

  // this is the top-right corner of the cell where the list indicator will render
  x: number;
  y: number;
}

export class CellsTextHashSpecial {
  // hashmap of x,y coordinates to checkboxes
  special: RenderSpecial;

  constructor() {
    this.special = { checkboxes: [], dropdowns: [] };
  }

  clear() {
    this.special = { checkboxes: [], dropdowns: [] };
  }

  addCheckbox(column: number, row: number, x: number, y: number, value: boolean) {
    this.special.checkboxes.push({ column, row, x, y, value });
  }

  addDropdown(column: number, row: number, x: number, y: number) {
    this.special.dropdowns.push({ column, row, x, y });
  }

  isEmpty() {
    return this.special.checkboxes.length === 0 && this.special.dropdowns.length === 0;
  }
}
