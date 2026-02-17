import { sheets } from '@/app/grid/controller/Sheets';
import { Bounds } from '@/app/grid/sheet/Bounds';
import type { CellsTextHash } from '@/app/gridGL/cells/cellsLabel/CellsTextHash';
import { TRIANGLE_SCALE } from '@/app/gridGL/cells/CellsMarkers';
import type { ErrorMarker, ErrorValidation } from '@/app/gridGL/cells/CellsSheet';
import { generatedTextures } from '@/app/gridGL/generateTextures';
import type { JsValidationWarning } from '@/app/quadratic-core-types';
import { colors } from '@/app/theme/colors';
import type { Point, Rectangle } from 'pixi.js';
import { Container, Sprite } from 'pixi.js';

export class CellsTextHashValidations extends Container {
  private cellsTextHash: CellsTextHash;
  private sheetId: string;
  private warnings: JsValidationWarning[] = [];
  private warningSprites: Map<string, [Sprite, Rectangle, string]> = new Map();

  // any bounds for the warnings
  bounds: Bounds;

  constructor(cellsTextHash: CellsTextHash, sheetId: string) {
    super();
    this.cellsTextHash = cellsTextHash;
    this.sheetId = sheetId;
    this.bounds = new Bounds();
  }

  private addWarning(x: number, y: number, color: number): Sprite {
    const sprite = this.addChild(new Sprite(generatedTextures.triangle));
    sprite.tint = color;
    // flips the triangle so it properly aligns to the top-right corner
    sprite.scale.set(-TRIANGLE_SCALE, TRIANGLE_SCALE);
    sprite.position.set(x, y);
    sprite.anchor.set(1, 0);
    sprite.rotation = Math.PI / 2;
    this.bounds.addRectanglePoints(
      x - sprite.width + this.cellsTextHash.AABB.x,
      y,
      sprite.width,
      sprite.height + this.cellsTextHash.AABB.y
    );
    return sprite;
  }

  // This is called when the entire hash has been rendered by core and all known
  // warnings are available.
  populate(warnings: JsValidationWarning[]) {
    this.removeChildren();
    this.bounds.clear();
    this.warningSprites = new Map();
    if (warnings.length) {
      const sheet = sheets.getById(this.sheetId);
      if (!sheet) throw new Error('Expected sheet to be defined in CellsTextHashValidations');
      warnings.forEach((warning) => {
        const { pos, validation, style } = warning;
        const { x, y } = pos;
        if (!validation) return;

        // Check if the cell is part of a merged cell and use the full merged cell rect
        const mergeRect = sheet.getMergeCellRect(Number(x), Number(y));
        let offset: Rectangle;
        if (mergeRect) {
          offset = sheet.getScreenRectangle(
            Number(mergeRect.min.x),
            Number(mergeRect.min.y),
            Number(mergeRect.max.x) - Number(mergeRect.min.x) + 1,
            Number(mergeRect.max.y) - Number(mergeRect.min.y) + 1
          );
        } else {
          offset = sheet.getCellOffsets(x, y);
        }

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
        this.warningSprites.set(`${x},${y}`, [sprite, offset, validation]);
      });
    }
    this.warnings = warnings;
    this.cellsTextHash.updateHashBounds();
  }

  // This is used when individual cells warnings have updated, but we've not
  // rerendered the entire hash.
  updateWarnings(warning: JsValidationWarning) {
    const index = this.warnings.findIndex((w) => w.pos.x === warning.pos.x && w.pos.y === warning.pos.y);
    if (index === -1) {
      if (warning.validation) {
        this.warnings.push(warning);
      }
    } else {
      if (warning.validation) {
        this.warnings[index] = warning;
      } else {
        this.warnings.splice(index, 1);
      }
    }
    this.populate(this.warnings);
  }

  // returns a validation warning id for a cell
  getValidationWarningId(x: number, y: number): string | undefined {
    return (
      this.warnings.find((warning) => warning.pos.x === BigInt(x) && warning.pos.y === BigInt(y))?.validation ??
      undefined
    );
  }

  getErrorMarker(x: number, y: number): ErrorMarker | undefined {
    const sprite = this.warningSprites.get(`${x},${y}`);
    if (sprite) {
      return { triangle: sprite[0] };
    }
  }

  intersectsErrorMarkerValidation(world: Point): ErrorValidation | undefined {
    for (const [key, sprite] of this.warningSprites) {
      const [x, y] = key.split(',').map((n) => parseInt(n));
      if (sprite[1].contains(world.x, world.y)) {
        return { x, y, validationId: sprite[2], value: undefined };
      }
    }
  }

  reposition() {
    const sheet = sheets.sheet;
    this.warnings.forEach((warning) => {
      const { pos } = warning;
      // Check if the cell is part of a merged cell and use the full merged cell rect
      const mergeRect = sheet.getMergeCellRect(Number(pos.x), Number(pos.y));
      let offset: Rectangle;
      if (mergeRect) {
        offset = sheet.getScreenRectangle(
          Number(mergeRect.min.x),
          Number(mergeRect.min.y),
          Number(mergeRect.max.x) - Number(mergeRect.min.x) + 1,
          Number(mergeRect.max.y) - Number(mergeRect.min.y) + 1
        );
      } else {
        offset = sheet.getCellOffsets(pos.x, pos.y);
      }
      const sprite = this.warningSprites.get(`${pos.x},${pos.y}`);
      if (sprite) {
        sprite[0].position.set(offset.x + offset.width, offset.y);
        sprite[1] = offset;
      }
    });
  }
}
