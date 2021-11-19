import type { Viewport } from "pixi-viewport";
import type Grid from "../core/grid/Grid";

export default class Globals {
  viewport: Viewport;
  canvas: HTMLCanvasElement;
  grid: Grid;

  constructor(viewport: Viewport, canvas: HTMLCanvasElement, grid: Grid) {
    this.viewport = viewport;
    this.canvas = canvas;
    this.grid = grid;
  }
}
