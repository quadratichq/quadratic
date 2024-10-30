//! Holds borders for tables and code errors.

// todo: this should move to TableOutline

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { Sheet } from '@/app/grid/sheet/Sheet';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { Coordinate } from '@/app/gridGL/types/size';
import { getCSSVariableTint } from '@/app/helpers/convertColor';
import { JsCodeCell, JsRenderCodeCell, RunError } from '@/app/quadratic-core-types';
import mixpanel from 'mixpanel-browser';
import { Container, Graphics, ParticleContainer, Rectangle, Sprite, Texture } from 'pixi.js';
import { intersects } from '../helpers/intersects';
import { pixiApp } from '../pixiApp/PixiApp';
import { CellsSheet } from './CellsSheet';
import { BorderCull, drawBorder } from './drawBorders';

export class CellsArray extends Container {
  private cellsSheet: CellsSheet;
  private codeCells: Map<String, JsRenderCodeCell>;
  private tables: Map<String, Rectangle>;

  private particles: ParticleContainer;

  // only used for the spill error indicators (lines are drawn using sprites in particles for performance)
  private graphics: Graphics;
  private lines: BorderCull[];

  constructor(cellsSheet: CellsSheet) {
    super();
    this.particles = this.addChild(new ParticleContainer(undefined, { vertices: true, tint: true }, undefined, true));
    this.graphics = this.addChild(new Graphics());
    this.cellsSheet = cellsSheet;
    this.lines = [];
    this.codeCells = new Map();
    this.tables = new Map();
    events.on('renderCodeCells', this.renderCodeCells);
    events.on('sheetOffsets', this.sheetOffsets);
    events.on('updateCodeCell', this.updateCodeCell);
  }

  destroy() {
    events.off('renderCodeCells', this.renderCodeCells);
    events.off('sheetOffsets', this.sheetOffsets);
    events.off('updateCodeCell', this.updateCodeCell);
    super.destroy();
  }

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }

  private renderCodeCells = (sheetId: string, codeCells: JsRenderCodeCell[]) => {
    if (sheetId === this.sheetId) {
      const map = new Map();
      codeCells.forEach((cell) => map.set(this.key(cell.x, cell.y), cell));
      this.codeCells = map;
      this.create();
    }
  };

  private sheetOffsets = (sheetId: string) => {
    if (sheetId === this.cellsSheet.sheetId) {
      this.create();
    }
  };

  private updateCodeCell = (options: {
    sheetId: string;
    x: number;
    y: number;
    renderCodeCell?: JsRenderCodeCell;
    codeCell?: JsCodeCell;
  }) => {
    const { sheetId, x, y, renderCodeCell, codeCell } = options;
    if (sheetId === this.sheetId) {
      if (renderCodeCell) {
        this.codeCells.set(this.key(x, y), renderCodeCell);
      } else {
        this.codeCells.delete(this.key(x, y));
      }
      this.create();

      if (!!codeCell && codeCell.std_err !== null && codeCell.evaluation_result) {
        try {
          // std_err is not null, so evaluation_result will be RunError
          const runError = JSON.parse(codeCell.evaluation_result) as RunError;
          // track unimplemented errors
          if (typeof runError.msg === 'object' && 'Unimplemented' in runError.msg) {
            mixpanel.track('[CellsArray].updateCodeCell', {
              type: codeCell.language,
              error: runError.msg,
            });
          }
        } catch (error) {
          console.error('[CellsArray] Error parsing codeCell.evaluation_result', error);
        }
      }
    }
  };

  get sheetId(): string {
    return this.cellsSheet.sheetId;
  }

  private create() {
    this.lines = [];
    this.particles.removeChildren();
    this.graphics.clear();
    this.cellsSheet.cellsMarkers.clear();
    const codeCells = this.codeCells;
    if (codeCells.size === 0) {
      pixiApp.setViewportDirty();
      return;
    }

    const cursor = sheets.sheet.cursor.getCursor();
    codeCells?.forEach((codeCell) => {
      const cell = inlineEditorHandler.getShowing();
      const editingCell = cell && codeCell.x === cell.x && codeCell.y === cell.y && cell.sheetId === this.sheetId;
      this.draw(codeCell, cursor, editingCell);
    });
    pixiApp.setViewportDirty();
  }

  updateCellsArray = () => {
    this.create();
  };

  cheapCull = (bounds: Rectangle): void => {
    this.lines.forEach((line) => (line.sprite.visible = intersects.rectangleRectangle(bounds, line.rectangle)));
  };

  get sheet(): Sheet {
    const sheet = sheets.getById(this.sheetId);
    if (!sheet) throw new Error('Expected sheet to be defined in CellsArray.sheet');
    return sheet;
  }

  private draw(codeCell: JsRenderCodeCell, cursor: Coordinate, editingCell?: boolean): void {
    const start = this.sheet.getCellOffsets(Number(codeCell.x), Number(codeCell.y));

    const overlapTest = new Rectangle(Number(codeCell.x), Number(codeCell.y), codeCell.w - 1, codeCell.h - 1);
    if (codeCell.spill_error) {
      overlapTest.width = 1;
      overlapTest.height = 1;
    }

    const tint = getCSSVariableTint('primary');

    // old code that draws a box around the code cell
    // let tint = colors.independence;
    // if (codeCell.language === 'Python') {
    //   tint = colors.cellColorUserPython;
    // } else if (codeCell.language === 'Formula') {
    //   tint = colors.cellColorUserFormula;
    // } else if (codeCell.language === 'Javascript') {
    //   tint = colors.cellColorUserJavascript;
    // }

    // if (!pixiAppSettings.showCellTypeOutlines) {
    //   // only show the entire array if the cursor overlaps any part of the output
    //   if (!intersects.rectanglePoint(overlapTest, new Point(cursor.x, cursor.y))) {
    //     this.cellsSheet.cellsMarkers.add(start, codeCell, false);
    //     return;
    //   }
    // }

    if (!editingCell) {
      this.cellsSheet.cellsMarkers.add(start, codeCell, true);
    }

    const end = this.sheet.getCellOffsets(
      Number(codeCell.x) + (codeCell.spill_error ? 1 : codeCell.w),
      Number(codeCell.y) + (codeCell.spill_error ? 1 : codeCell.h)
    );
    this.drawBox(start, end, tint);

    // save the entire table for hover checks
    if (!codeCell.spill_error) {
      const endTable = this.sheet.getCellOffsets(Number(codeCell.x) + codeCell.w, Number(codeCell.y) + codeCell.h);
      this.tables.set(
        this.key(codeCell.x, codeCell.y),
        new Rectangle(start.x, start.y, endTable.x - start.x, endTable.y - start.y)
      );
    }
  }

  private drawBox(start: Rectangle, end: Rectangle, tint: number) {
    this.lines.push(
      ...drawBorder({
        alpha: 0.5,
        tint,
        x: start.x,
        y: start.y,
        width: end.x - start.x,
        height: end.y - start.y,
        getSprite: this.getSprite,
        top: true,
        left: true,
        bottom: true,
        right: true,
      })
    );
    // const right = end.x !== start.x + start.width;
    // if (right) {
    //   this.lines.push(
    //     drawLine({
    //       x: start.x + start.width - borderLineWidth / 2,
    //       y: start.y + borderLineWidth / 2,
    //       width: borderLineWidth,
    //       height: start.height,
    //       alpha: 0.5,
    //       tint,
    //       getSprite: this.getSprite,
    //     })
    //   );
    // }
    // const bottom = end.y !== start.y + start.height;
    // if (bottom) {
    //   this.lines.push(
    //     drawLine({
    //       x: start.x + borderLineWidth / 2,
    //       y: start.y + start.height - borderLineWidth / 2,
    //       width: start.width - borderLineWidth,
    //       height: borderLineWidth,
    //       alpha: 0.5,
    //       tint,
    //       getSprite: this.getSprite,
    //     })
    //   );
    // }
  }

  private getSprite = (): Sprite => {
    return this.particles.addChild(new Sprite(Texture.WHITE));
  };
}
