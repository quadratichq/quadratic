import { Renderer, Container } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { isMobileOnly } from 'react-device-detect';
import { PixiAppSettings } from './PixiAppSettings';
import { Input } from '../input/Input';
import { Update } from './Update';
import './pixiApp.css';
import { GridOffsets } from '../../gridDB/gridOffsets';

export class PixiApp {
  private parent?: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private update: Update;
  input: Input;
  viewport: Viewport;
  gridOffsets: GridOffsets;
  settings: PixiAppSettings;
  renderer: Renderer;
  stage = new Container();
  destroyed = false;
  dirty = true;

  constructor() {
    this.settings = new PixiAppSettings();
    this.gridOffsets = new GridOffsets();

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
    this.viewport.on('zoomed', () => (this.dirty = true));
    this.viewport.on('moved', () => (this.dirty = true));
    this.input = new Input(this);
    this.update = new Update(this);
    console.log('[QuadraticGL] environment ready');
  }

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
  }

}