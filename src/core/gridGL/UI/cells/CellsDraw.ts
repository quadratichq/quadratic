import Color from 'color';
import { Container, Graphics, GraphicsGeometry } from 'pixi.js';
import { colors } from '../../../../theme/colors';
import { Cell, CellFormat } from '../../../gridDB/db';
import { PixiApp } from '../../pixiApp/PixiApp';

export interface ICellsDraw {
  x: number;
  y: number;
  width: number;
  height: number;
  cell?: Cell;
  format?: CellFormat;
}

export class CellsDraw extends Container {
  private app: PixiApp;
  private geometryCache = new Map<string, GraphicsGeometry>();

  constructor(app: PixiApp) {
    super();
    this.app = app;
  }

  private getGeometryHash(input: ICellsDraw): string | undefined {
    return `${input?.cell?.type[0] ?? ""}${input?.format?.fillColor ?? ""}}${input.width},${input.height}`;
  }

  clear() {
    this.removeChildren();
  }

  draw(input: ICellsDraw, graphics: Graphics): void {
    if (input.format) {
      if (input.format.fillColor) {
        const color = Color(input.format.fillColor);
        graphics.beginFill(color.rgbNumber(), color.alpha());
        graphics.drawRect(0, 0, input.width, input.height);
        graphics.endFill();
      }
    }

    if (!input.cell || !this.app.settings.showCellTypeOutlines) return;

    // Change outline color based on cell type but don't draw TEXT cell outlines since it's handled by the grid
    if (input.cell.type === 'TEXT') {
      graphics.lineStyle(1, colors.cellColorUserText, 0.75, 0.5, true);
    } else if (input.cell.type === 'PYTHON') {
      graphics.lineStyle(1, colors.cellColorUserPython, 0.75, 0.5, true);
    } else if (input.cell.type === 'COMPUTED') {
      graphics.lineStyle(1, colors.independence, 0.75, 0.5, true);
    }

    // Draw outline
    graphics.drawRect(0, 0, input.width, input.height);
  }

  add(input: ICellsDraw): void {
    const geometryHash = this.getGeometryHash(input);
    if (!geometryHash) return;
    const geometry = this.geometryCache.get(geometryHash);
    let graphics: Graphics;
    if (geometry) {
      graphics = this.addChild(new Graphics(geometry));
    } else {
      graphics = this.addChild(new Graphics());
      this.draw(input, graphics);
      this.geometryCache.set(geometryHash, graphics.geometry);
    }
    graphics.position.set(input.x, input.y);
  }
}