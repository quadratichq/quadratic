import Cell from "./Cell";
import CellReference from "../types/cellReference";
import { Viewport } from "pixi-viewport";

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

  createOrUpdateCell(location: CellReference, text: string) {
    let cell: Cell | null = this.getCell(location);

    if (cell === null) {
      if (this.data[location.x] === undefined) {
        this.data[location.x] = {};
      }

      this.data[location.x][location.y] = new Cell(
        { x: location.x, y: location.y },
        this.viewport,
        text
      );
    } else {
      cell.update(text);
    }
  }
}
