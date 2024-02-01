import { sheets } from '@/grid/controller/Sheets';
import { JsRenderCodeCell } from '@/quadratic-core/types';
import { Container, Graphics, ParticleContainer, Rectangle, Sprite, Texture } from 'pixi.js';
import { Sheet } from '../../grid/sheet/Sheet';
import { colors } from '../../theme/colors';
import { dashedTextures } from '../dashedTextures';
import { intersects } from '../helpers/intersects';
import { pixiAppSettings } from '../pixiApp/PixiAppSettings';
import { CellsSheet } from './CellsSheet';
import { BorderCull, borderLineWidth, drawBorder, drawLine } from './drawBorders';

const SPILL_HIGHLIGHT_THICKNESS = 1;
const SPILL_HIGHLIGHT_COLOR = colors.cellColorError;
const SPILL_FILL_ALPHA = 0.025;

export class CellsArray extends Container {
  private cellsSheet: CellsSheet;
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
  }

  get sheet(): Sheet {
    return this.cellsSheet.sheet;
  }

  create(): void {
    this.particles.removeChildren();
    this.graphics.clear();
    this.lines = [];
    const cursor = sheets.sheet.cursor;
    const codeCells = this.cellsSheet.sheet.getRenderCodeCells();
    this.cellsSheet.cellsMarkers.clear();
    const cursorRectangle = cursor.getRectangle();

    // need to adjust the cursor rectangle for intersection testing
    cursorRectangle.width++;
    cursorRectangle.height++;
    codeCells?.forEach((codeCell) => {
      this.draw(codeCell, cursorRectangle);
    });
  }

  cheapCull(bounds: Rectangle): void {
    this.lines.forEach((line) => (line.sprite.visible = intersects.rectangleRectangle(bounds, line.rectangle)));
  }

  private draw(codeCell: JsRenderCodeCell, cursorRectangle: Rectangle): void {
    const start = this.sheet.getCellOffsets(Number(codeCell.x), Number(codeCell.y));
    let end = this.sheet.getCellOffsets(Number(codeCell.x) + codeCell.w, Number(codeCell.y) + codeCell.h);

    const overlapTest = new Rectangle(Number(codeCell.x), Number(codeCell.y), codeCell.w, codeCell.h);
    if (codeCell.spill_error) {
      overlapTest.width = 1;
      overlapTest.height = 1;
    }

    let tint = colors.independence;
    if (codeCell.language === 'Python') {
      tint = colors.cellColorUserPython;
    } else if (codeCell.language === 'Formula') {
      tint = colors.cellColorUserFormula;
    }

    if (!pixiAppSettings.showCellTypeOutlines) {
      // only show the entire array if the cursor overlaps any part of the output
      if (!intersects.rectangleRectangle(cursorRectangle, overlapTest)) {
        this.cellsSheet.cellsMarkers.add(start, codeCell, false);
        return;
      }
    }

    this.cellsSheet.cellsMarkers.add(start, codeCell, true);
    if (codeCell.spill_error) {
      const cursorPosition = sheets.sheet.cursor.cursorPosition;
      if (cursorPosition.x !== Number(codeCell.x) || cursorPosition.y !== Number(codeCell.y)) {
        this.lines.push(
          ...drawBorder({
            alpha: 0.5,
            tint,
            x: start.x,
            y: start.y,
            width: start.width,
            height: start.height,
            getSprite: this.getSprite,
            top: true,
            left: true,
            bottom: true,
            right: true,
          })
        );
      } else {
        this.drawDashedRectangle(new Rectangle(start.x, start.y, end.x - start.x, end.y - start.y), tint);
        codeCell.spill_error?.forEach((error) => {
          const rectangle = this.sheet.getCellOffsets(Number(error.x), Number(error.y));
          this.drawDashedRectangle(rectangle, SPILL_HIGHLIGHT_COLOR);
        });
      }
    } else {
      this.drawBox(start, end, tint);
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
    const right = end.x !== start.x + start.width;
    if (right) {
      this.lines.push(
        drawLine({
          x: start.x + start.width - borderLineWidth / 2,
          y: start.y + borderLineWidth / 2,
          width: borderLineWidth,
          height: start.height,
          alpha: 0.5,
          tint,
          getSprite: this.getSprite,
        })
      );
    }
    const bottom = end.y !== start.y + start.height;
    if (bottom) {
      this.lines.push(
        drawLine({
          x: start.x + borderLineWidth / 2,
          y: start.y + start.height - borderLineWidth / 2,
          width: start.width - borderLineWidth,
          height: borderLineWidth,
          alpha: 0.5,
          tint,
          getSprite: this.getSprite,
        })
      );
    }
  }

  private drawDashedRectangle(rectangle: Rectangle, color: number) {
    this.graphics.lineStyle();
    this.graphics.beginFill(color, SPILL_FILL_ALPHA);
    this.graphics.drawRect(rectangle.left, rectangle.top, rectangle.width, rectangle.height);
    this.graphics.endFill();

    const minX = rectangle.left;
    const minY = rectangle.top;
    const maxX = rectangle.right;
    const maxY = rectangle.bottom;

    const path = [
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
      [minX, minY],
    ];

    this.graphics.moveTo(minX, minY);
    for (let i = 0; i < path.length; i++) {
      this.graphics.lineStyle({
        width: SPILL_HIGHLIGHT_THICKNESS,
        color,
        texture: i % 2 === 0 ? dashedTextures.dashedHorizontal : dashedTextures.dashedVertical,
      });
      this.graphics.lineTo(path[i][0], path[i][1]);
    }
  }

  private getSprite = (): Sprite => {
    return this.particles.addChild(new Sprite(Texture.WHITE));
  };
}
