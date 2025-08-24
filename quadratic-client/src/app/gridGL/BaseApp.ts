import type { Pointer } from '@/app/gridGL/interaction/pointer/Pointer';
import { MomentumScrollDetector } from '@/app/gridGL/pixiApp/MomentumScrollDetector';
import type { PixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Viewport } from '@/app/gridGL/pixiApp/viewport/Viewport';
import type { Background } from '@/app/gridGL/UI/Background';
import type { BoxCells } from '@/app/gridGL/UI/boxCells';
import type { CellHighlights } from '@/app/gridGL/UI/cellHighlights/CellHighlights';
import type { Cursor } from '@/app/gridGL/UI/Cursor';
import type { HtmlPlaceholders } from '@/app/gridGL/UI/HtmlPlaceholders';
import type { UICellImages } from '@/app/gridGL/UI/UICellImages';
import type { UICellMoving } from '@/app/gridGL/UI/UICellMoving';
import type { UICopy } from '@/app/gridGL/UI/UICopy';
import type { UIMultiPlayerCursor } from '@/app/gridGL/UI/UIMultiplayerCursor';
import type { UISingleCellOutlines } from '@/app/gridGL/UI/UISingleCellOutlines';
import type { UIValidations } from '@/app/gridGL/UI/UIValidations';
import { colors } from '@/app/theme/colors';
import type { Container } from 'pixi.js';
import { Renderer } from 'pixi.js';

export abstract class BaseApp {
  private observer?: ResizeObserver;

  canvas: HTMLCanvasElement;
  renderer: Renderer;
  viewport: Viewport;

  background?: Background;
  cursor?: Cursor;
  multiplayerCursor?: UIMultiPlayerCursor;
  cellHighlights?: CellHighlights;

  pointer?: Pointer;

  momentumDetector: MomentumScrollDetector;

  accentColor = colors.cursorCell;

  destroyed = false;

  cellMoving?: UICellMoving;
  boxCells?: BoxCells;
  htmlPlaceholders?: HtmlPlaceholders;
  imagePlaceholders?: Container;
  cellImages?: UICellImages;
  validations?: UIValidations;
  copy?: UICopy;
  singleCellOutlines?: UISingleCellOutlines;

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
  }

  destroy() {
    this.destroyed = true;
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

  resize = (): void => {
    if (!this.canvas.parentNode || this.destroyed) return;
    const width = (this.canvas.parentNode as HTMLElement).offsetWidth;
    const height = (this.canvas.parentNode as HTMLElement).offsetHeight;
    this.canvas.width = this.renderer.resolution * width;
    this.canvas.height = this.renderer.resolution * height;
    this.renderer.resize(width, height);
    this.viewport.resize(width, height);
    this.setViewportDirty();
  };

  setViewportDirty = () => {
    this.viewport.dirty = true;
  };

  setCursorDirty = (dirty?: { cursor?: boolean; multiplayerCursor?: boolean }) => {
    if (this.cursor && (!dirty || dirty.cursor)) {
      this.cursor.dirty = true;
    }
    if (this.multiplayerCursor && (!dirty || dirty.multiplayerCursor)) {
      this.multiplayerCursor.dirty = true;
    }
  };
}
