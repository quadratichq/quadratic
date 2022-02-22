import { Graphics } from "@pixi/graphics";
import type { Viewport } from "pixi-viewport";

export default class Globals {
  viewport: Viewport;
  canvas: HTMLCanvasElement;
  grid_ui: Graphics;

  constructor(
    viewport: Viewport,
    canvas: HTMLCanvasElement,
    grid_ui: Graphics
  ) {
    this.viewport = viewport;
    this.canvas = canvas;
    this.grid_ui = grid_ui;
  }
}
