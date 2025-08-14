import type { Pointer } from '@/app/gridGL/interaction/pointer/Pointer';
import { MomentumScrollDetector } from '@/app/gridGL/pixiApp/MomentumScrollDetector';
import { Viewport } from '@/app/gridGL/pixiApp/viewport/Viewport';
import { GridHeadings } from '@/app/gridGL/UI/gridHeadings/GridHeadings';
import { GridLines } from '@/app/gridGL/UI/GridLines';
import { Renderer } from 'pixi.js';

export abstract class BaseApp {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  viewport: Viewport;
  headings: GridHeadings;

  gridLines: GridLines;
  pointer?: Pointer;

  momentumDetector: MomentumScrollDetector;

  destroyed = false;

  constructor() {
    this.canvas = this.createCanvas();

    this.renderer = new Renderer({
      view: this.canvas,
      resolution: Math.max(2, window.devicePixelRatio),
      antialias: true,
      backgroundColor: 0xffffff,
    });
    this.viewport = new Viewport(this);
    this.momentumDetector = new MomentumScrollDetector();

    this.gridLines = new GridLines();
    this.headings = new GridHeadings();
  }

  destroy() {
    this.destroyed = true;
    // this.renderer.destroy(true);
  }

  private createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.classList.add('dark-mode-hack');
    canvas.className = 'pixi_canvas';
    canvas.tabIndex = 0;
    return canvas;
  }

  viewportChanged = () => {};

  setViewportDirty = () => {
    this.viewport.dirty = true;
  };
}
