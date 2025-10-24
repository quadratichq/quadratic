//! This tracks any special cells that will be rendered by the client. This
//! includes checkboxes and dropdown indicators.

import { Bounds } from '@/app/grid/sheet/Bounds';
import { checkboxRectangle, dropdownRectangle } from '@/app/gridGL/cells/cellsLabel/drawSpecial';
import { Rectangle } from 'pixi.js';

export interface RenderSpecial {
  checkboxes: RenderCheckbox[];
  dropdowns: RenderDropdown[];
  emojis: RenderEmoji[];
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

export interface RenderEmoji {
  codePoint: number;

  // this is the rectangle where the emoji will be rendered (relative to the hash)
  x: number;
  y: number;
  width: number;
  height: number;
}

export class CellsTextHashSpecial {
  // hashmap of x,y coordinates to checkboxes
  special: RenderSpecial;

  constructor() {
    this.special = { checkboxes: [], dropdowns: [], emojis: [] };
  }

  clear = () => {
    this.special = { checkboxes: [], dropdowns: [], emojis: [] };
  };

  addCheckbox = (column: number, row: number, x: number, y: number, value: boolean) => {
    this.special.checkboxes.push({ column, row, x, y, value });
  };

  addDropdown = (column: number, row: number, x: number, y: number) => {
    this.special.dropdowns.push({ column, row, x, y });
  };

  addEmojis = (emojis: RenderEmoji[]) => {
    this.special.emojis.push(...emojis);
  };

  isEmpty = () => {
    return (
      this.special.checkboxes.length === 0 && this.special.dropdowns.length === 0 && this.special.emojis.length === 0
    );
  };

  // Extends the view rectangle (bounds) to include any special cells
  extendViewRectangle = (rectangle: Rectangle) => {
    const bounds = new Bounds();
    bounds.addRectangle(rectangle);
    this.special.checkboxes.forEach((entry) => {
      const r = checkboxRectangle(entry.x, entry.y);
      bounds.addRectangle(r);
    });

    this.special.dropdowns.forEach((dropdown) => {
      const r = dropdownRectangle(dropdown.x, dropdown.y);
      const bounds = new Bounds();
      bounds.addRectangle(r);
    });
    this.special.emojis.forEach((emoji) => {
      const r = new Rectangle(emoji.x, emoji.y, emoji.width, emoji.height);
      bounds.addRectangle(r);
    });
    bounds.updateRectangle(rectangle);
  };

  adjustHeadings = (options: { delta: number; column?: number; row?: number }): boolean => {
    const { delta, column, row } = options;

    let changed = false;

    if (column !== undefined) {
      this.special.checkboxes.forEach((checkbox) => {
        if (checkbox.column === column) {
          checkbox.x -= delta / 2;
          changed = true;
        } else {
          if (column < 0) {
            if (checkbox.column < column) {
              checkbox.x += delta;
              changed = true;
            }
          } else {
            if (checkbox.column > column) {
              checkbox.x -= delta;
              changed = true;
            }
          }
        }
      });

      this.special.dropdowns.forEach((dropdown) => {
        if (dropdown.column === column) {
          dropdown.x -= delta;
          changed = true;
        } else {
          if (column < 0) {
            if (dropdown.column < column) {
              dropdown.x += delta;
              changed = true;
            }
          } else {
            if (dropdown.column > column) {
              dropdown.x -= delta;
              changed = true;
            }
          }
        }
      });
    } else if (row !== undefined) {
      this.special.checkboxes.forEach((checkbox) => {
        if (checkbox.row === row) {
          checkbox.y -= delta / 2;
          changed = true;
        } else {
          if (row < 0) {
            if (checkbox.row < row) {
              checkbox.y += delta;
              changed = true;
            }
          } else {
            if (checkbox.row > row) {
              checkbox.y -= delta;
              changed = true;
            }
          }
        }
      });

      this.special.dropdowns.forEach((dropdown) => {
        if (dropdown.row === row) {
          dropdown.y -= delta / 2;
          changed = true;
        } else {
          if (row < 0) {
            if (dropdown.row < row) {
              dropdown.y += delta;
              changed = true;
            }
          } else {
            if (dropdown.row > row) {
              dropdown.y -= delta;
              changed = true;
            }
          }
        }
      });
    }

    return changed;
  };
}
