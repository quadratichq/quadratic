import Cell from "./Cell";
import CellReference from "../types/cellReference";
import { Viewport } from "pixi-viewport";
import { apiDeleteCells } from "../api/APIClient";
import APIDeleteCell from "../api/interfaces/APIDeleteCell";

export default class Grid {
  data: { [key: string]: { [key: string]: Cell } };
  viewport: Viewport;

  constructor(viewport: Viewport) {
    this.data = {};
    this.viewport = viewport;
  }

  getCell(location: CellReference): Cell | null {
    if (this.data[location.x] === undefined) {
      return null;
    }
    return this.data[location.x][location.y] || null;
  }

  destroyCell(location: CellReference) {
    const cell = this.getCell({ x: location.x, y: location.y });
    if (cell) {
      apiDeleteCells([
        {
          x: location.x,
          y: location.y,
        },
      ]);
      cell.destroy();
      delete this.data[location.x][location.y];
    }
  }

  destroyCells(cell0: CellReference, cell1: CellReference) {
    const cWidth = Math.abs(cell1.x - cell0.x);
    const cHeight = Math.abs(cell1.y - cell0.y);

    const api_cells_to_delete: APIDeleteCell[] = [];

    for (let offset_y = 0; offset_y < cHeight; offset_y++) {
      for (let offset_x = 0; offset_x < cWidth; offset_x++) {
        let cell_x = cell0.x + offset_x;
        let cell_y = cell0.y + offset_y;

        const cell = this.getCell({ x: cell_x, y: cell_y });

        if (cell) {
          api_cells_to_delete.push({ x: cell_x, y: cell_y });
          cell.destroy();
          delete this.data[cell_x][cell_y];
        }
      }
    }

    apiDeleteCells(api_cells_to_delete);
  }

  createOrUpdateCell(location: CellReference, text: string) {
    let cell: Cell | null = this.getCell(location);

    if (cell === null) {
      if (this.data[location.x] === undefined) {
        this.data[location.x] = {};
      }

      this.data[location.x][location.y] = new Cell(
        { x: location.x, y: location.y },
        this.viewport,
        text,
        false // TODO: Detect if cell is computed.
      );
    } else {
      cell.update(text);
    }
  }
}
