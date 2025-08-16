import type { Pointer } from '@/app/gridGL/interaction/pointer/Pointer';
import { MomentumScrollDetector } from '@/app/gridGL/pixiApp/MomentumScrollDetector';
import type { PixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Viewport } from '@/app/gridGL/pixiApp/viewport/Viewport';
import { GridHeadings } from '@/app/gridGL/UI/gridHeadings/GridHeadings';
import { GridLines } from '@/app/gridGL/UI/GridLines';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { colors } from '@/app/theme/colors';
import { sharedEvents } from '@/shared/sharedEvents';
import { Renderer } from 'pixi.js';

export abstract class BaseApp {
  private observer?: ResizeObserver;

  canvas: HTMLCanvasElement;
  renderer: Renderer;
  viewport: Viewport;
  headings: GridHeadings;

  gridLines: GridLines;
  pointer?: Pointer;

  momentumDetector: MomentumScrollDetector;

  accentColor = colors.cursorCell;

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
    this.headings = new GridHeadings(this);

    this.setupListeners();
  }

  destroy() {
    this.destroyed = true;
    this.removeListeners();
    this.renderer.destroy(true);
    this.viewport.destroy();
  }

  private createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.classList.add('dark-mode-hack');
    canvas.className = 'pixi_canvas';
    canvas.tabIndex = 0;
    return canvas;
  }

  // this can be removed when BaseApp and PixiApp use the same components
  private isPixiApp(): PixiApp | undefined {
    if ('cursor' in this) {
      return this as any as PixiApp;
    }
  }

  protected setAccentColor = () => {
    // Pull the value from the current value as defined in CSS
    const accentColor = getCSSVariableTint('primary');
    this.accentColor = accentColor;
    this.gridLines.dirty = true;
    this.headings.dirty = true;

    const pixiApp = this.isPixiApp();
    if (pixiApp) {
      // TODO!
      // pixiApp.cursor.dirty = true;
      // pixiApp.cellHighlights.setDirty();
    }
  };

  resize = (): void => {
    if (!this.canvas.parentNode || this.destroyed) return;
    const width = (this.canvas.parentNode as HTMLElement).offsetWidth;
    const height = (this.canvas.parentNode as HTMLElement).offsetHeight;
    this.canvas.width = this.renderer.resolution * width;
    this.canvas.height = this.renderer.resolution * height;
    this.renderer.resize(width, height);
    this.viewport.resize(width, height);
    this.gridLines.dirty = true;
    this.headings.dirty = true;
    const pixiApp = this.isPixiApp();
    if (pixiApp) {
      pixiApp.cursor.dirty = true;
      pixiApp.cellHighlights.setDirty();
    }
    this.setViewportDirty();
  };

  private setupListeners() {
    sharedEvents.on('changeThemeAccentColor', this.setAccentColor);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(this.canvas);
    this.resize();
  }

  private removeListeners() {
    sharedEvents.off('changeThemeAccentColor', this.setAccentColor);
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }
  }

  viewportChanged = () => {};

  setViewportDirty = () => {
    this.viewport.dirty = true;
  };
}
