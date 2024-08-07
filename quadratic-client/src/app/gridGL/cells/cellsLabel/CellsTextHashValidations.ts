import { sheets } from '@/app/grid/controller/Sheets';
import { JsValidationWarning } from '@/app/quadratic-core-types';
import { Container, Sprite } from 'pixi.js';
import { generatedTextures } from '../../generateTextures';
import { colors } from '@/app/theme/colors';
import { TRIANGLE_SCALE } from '../CellsMarkers';
import { ErrorMarker } from '../CellsSheet';

export class CellsTextHashValidations extends Container {
  private sheetId: string;
  private warnings: JsValidationWarning[] = [];
  private warningSprites: Map<string, Sprite> = new Map();

  constructor(sheetId: string) {
    super();
    this.sheetId = sheetId;
  }

  private addWarning(x: number, y: number, color: number): Sprite {
    const sprite = this.addChild(new Sprite(generatedTextures.triangle));
    sprite.tint = color;
    sprite.scale.set(TRIANGLE_SCALE);
    sprite.position.set(x, y + sprite.height);
    sprite.anchor.set(1, 0);
    sprite.rotation = Math.PI / 2;
    return sprite;
  }

  populate(warnings: JsValidationWarning[]) {
    this.removeChildren();
    this.warningSprites = new Map();
    if (warnings.length) {
      const sheet = sheets.getById(this.sheetId);
      if (!sheet) throw new Error('Expected sheet to be defined in CellsTextHashValidations');
      warnings.forEach((warning) => {
        const { x, y, style } = warning;
        const offset = sheet.getCellOffsets(x, y);
        let color = 0;
        switch (style) {
          case 'Stop':
            color = colors.cellColorError;
            break;
          case 'Warning':
            color = colors.cellColorWarning;
            break;
          case 'Information':
            color = colors.cellColorInfo;
            break;
        }
        const sprite = this.addWarning(offset.x + offset.width, offset.y, color);
        this.warningSprites.set(`${x},${y}`, sprite);
      });
    }
    this.warnings = warnings;
  }

  // returns a validation warning id for a cell
  getValidationWarningId(x: number, y: number): string | undefined {
    return this.warnings.find((warning) => warning.x === BigInt(x) && warning.y === BigInt(y))?.validation;
  }

  getErrorMarker(x: number, y: number): ErrorMarker | undefined {
    const sprite = this.warningSprites.get(`${x},${y}`);
    if (sprite) {
      return { triangle: sprite };
    }
  }
}
