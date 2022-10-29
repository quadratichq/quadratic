import { Renderer, Container } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { isMobileOnly } from 'react-device-detect';
import { PixiAppSettings } from './PixiAppSettings';
import { Input } from '../input/Input';
import { Update } from './Update';
import './pixiApp.css';
import { GridOffsets } from '../../gridDB/gridOffsets';
import { GridLines } from '../UI/GridLines';
import { AxesLines } from '../UI/AxesLines';
import { GridHeadings } from '../UI/gridHeadings/GridHeadings';
import { Cursor } from '../UI/cursor';
import { Cells } from '../UI/cells/Cells';
import { gridSpare } from '../../gridDB/gridSparse';

export class PixiApp {
  private parent?: HTMLDivElement;
  private update: Update;
  canvas: HTMLCanvasElement;
  gridLines: GridLines;
  axesLines: AxesLines;
  cursor: Cursor;
  headings: GridHeadings;
  cells: Cells;

  input: Input;
  viewport: Viewport;
  gridOffsets: GridOffsets;
  grid: gridSpare;
  settings: PixiAppSettings;
  renderer: Renderer;
  stage = new Container();
  destroyed = false;

  constructor() {
    this.gridOffsets = new GridOffsets(this);
    this.grid = new gridSpare(this);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pixi_canvas';
    this.canvas.tabIndex = 0;

    const resolution = Math.max(2, window.devicePixelRatio)
    this.renderer = new Renderer({
      view: this.canvas,
      resolution,
      antialias: true,
      backgroundColor: 0xffffff,
    });

    this.viewport = new Viewport({ interaction: this.renderer.plugins.interaction });
    this.stage.addChild(this.viewport);
    this.viewport
      .drag({ pressDrag: isMobileOnly }) // enable drag on mobile, no where else
      .decelerate()
      .pinch()
      .wheel({ trackpadPinch: true, wheelZoom: false, percent: 1.5 })
      .clampZoom({
        minScale: 0.01,
        maxScale: 10,
      });

    this.gridLines = this.viewport.addChild(new GridLines(this));
    this.axesLines = this.viewport.addChild(new AxesLines(this));
    this.cursor = this.viewport.addChild(new Cursor(this));
    this.cells = this.viewport.addChild(new Cells(this));
    this.headings = this.viewport.addChild(new GridHeadings(this));

    this.settings = new PixiAppSettings(this);

    if (this.settings.showHeadings) {
      this.viewport.position.set(20, 20);
    }

    this.viewport.on('zoomed', () => {
      this.viewportChanged();
      this.settings.setZoomState && this.settings.setZoomState(this.viewport.scale.x);
    });
    this.viewport.on('moved', this.viewportChanged);

    this.input = new Input(this);
    this.update = new Update(this);

    console.log('[QuadraticGL] environment ready');
  }

  private viewportChanged = (): void => {
    this.gridLines.dirty = true;
    this.axesLines.dirty = true;
    this.cells.dirty = true;
  };

  attach(parent: HTMLDivElement): void {
    this.parent = parent;
    parent.appendChild(this.canvas);
    this.resize();
    this.parent.addEventListener('resize', this.resize);
    this.update.start();
  }

  destroy(): void {
    this.update.destroy();
    this.renderer.destroy(true);
    this.viewport.destroy();
    this.destroyed = true;
  }

  private resize(): void {
    if (!this.parent || this.destroyed) return;

    const width = this.parent.offsetWidth;
    const height = this.parent.offsetHeight;
    this.canvas.width = this.renderer.resolution * width;
    this.canvas.height = this.renderer.resolution * height;
    this.renderer.resize(width, height);
    this.viewport.resize(width, height);
  }
}