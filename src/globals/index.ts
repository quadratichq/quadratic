import * as React from "react";
import { Graphics } from "@pixi/graphics";
import type { Viewport } from "pixi-viewport";
import type Grid from "../core/grid/Grid";
import CellTypeMenu from "../ui/menus/CellTypeMenu";

export default class Globals {
  viewport: Viewport;
  canvas: HTMLCanvasElement;
  grid: Grid;
  grid_ui: Graphics;
  cell_type_menu_ref: React.RefObject<CellTypeMenu>;

  constructor(
    viewport: Viewport,
    canvas: HTMLCanvasElement,
    grid: Grid,
    grid_ui: Graphics,
    cell_type_menu_ref: React.RefObject<CellTypeMenu>
  ) {
    this.viewport = viewport;
    this.canvas = canvas;
    this.grid = grid;
    this.grid_ui = grid_ui;
    this.cell_type_menu_ref = cell_type_menu_ref;
  }
}
