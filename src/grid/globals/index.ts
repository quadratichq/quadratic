import { Graphics } from "@pixi/graphics";
import type { Viewport } from "pixi-viewport";
import type Grid from "../graphics/grid/GridManager";

export default class Globals {
  viewport: Viewport;
  canvas: HTMLCanvasElement;
  grid: Grid;
  grid_ui: Graphics;

  constructor(
    viewport: Viewport,
    canvas: HTMLCanvasElement,
    grid: Grid,
    grid_ui: Graphics
  ) {
    this.viewport = viewport;
    this.canvas = canvas;
    this.grid = grid;
    this.grid_ui = grid_ui;
  }
}
