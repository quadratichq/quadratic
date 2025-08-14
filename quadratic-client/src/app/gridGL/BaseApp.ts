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
    // this.renderer.destroy(true);
  }

  private createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.classList.add('dark-mode-hack');
    canvas.className = 'pixi_canvas';
    canvas.tabIndex = 0;
    return canvas;
  }

  protected setAccentColor = () => {
    // Pull the value from the current value as defined in CSS
    const accentColor = getCSSVariableTint('primary');
    this.accentColor = accentColor;
    this.gridLines.dirty = true;
    this.headings.dirty = true;

    // this can be removed when BaseApp and PixiApp use the same components
    if ('cursor' in this) {
      const pixiApp = this as any as PixiApp;
      pixiApp.cursor.dirty = true;
      pixiApp.cellHighlights.setDirty();
    }
  };

  private setupListeners() {
    sharedEvents.on('changeThemeAccentColor', this.setAccentColor);
  }

  private removeListeners() {
    sharedEvents.off('changeThemeAccentColor', this.setAccentColor);
  }

  viewportChanged = () => {};

  setViewportDirty = () => {
    this.viewport.dirty = true;
  };
}
