//! These are UI Validation elements that are applied to columns, rows, or all.
//! Individual cell (Selection.rects) validations are applied via the
//! CellsTextHashSpecial. Since there are "infinite", we only apply them to the
//! visible cells and redraw them whenever the viewport moves.

import { hasPermissionToEditFile } from '@/app/actions';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { SpecialSprite } from '@/app/gridGL/cells/cellsLabel/drawSpecial';
import { drawCheckbox, drawDropdown, DROPDOWN_PADDING, DROPDOWN_SIZE } from '@/app/gridGL/cells/cellsLabel/drawSpecial';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { getRangeRectangleFromCellRefRange } from '@/app/gridGL/helpers/selection';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import type { JsHashValidationWarnings, RefRangeBounds } from '@/app/quadratic-core-types';
import type { ValidationUIType } from '@/app/ui/menus/Validations/Validation/validationType';
import { validationUIType } from '@/app/ui/menus/Validations/Validation/validationType';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { Point } from 'pixi.js';
import { Container } from 'pixi.js';

const MINIMUM_SCALE_TO_SHOW_VALIDATIONS = 0.25;
const FADE_SCALE = 0.1;

export class UIValidations extends Container<SpecialSprite> {
  dirty = true;

  private occupied: Set<string>;

  constructor() {
    super();
    this.occupied = new Set();
    events.on('sheetValidations', this.setDirty);
    events.on('validationWarnings', this.setDirtyValidationsWarnings);
  }

  destroy() {
    events.off('sheetValidations', this.setDirty);
    events.off('validationWarnings', this.setDirtyValidationsWarnings);
    super.destroy();
  }

  setDirty = (sheetId: string) => {
    if (sheetId === sheets.current) {
      this.dirty = true;
    }
  };

  setDirtyValidationsWarnings = (warnings: JsHashValidationWarnings[]) => {
    if (warnings.some((w) => w.sheet_id.id === sheets.current)) {
      this.dirty = true;
    }
  };

  private drawValidations() {
    // we need to take the validations in reverse order
    const validations = sheets.sheet.validations;
    for (let i = validations.length - 1; i >= 0; i--) {
      const v = validations[i];
      const type = validationUIType(v);
      if (v.selection.sheet_id.id !== sheets.current || !type) continue;

      try {
        const jsSelection = sheets.A1SelectionToJsSelection(v.selection);
        const infiniteRanges: RefRangeBounds[] = jsSelection.getInfiniteRefRangeBounds();
        jsSelection.free();
        infiniteRanges.forEach((range) => this.drawInfiniteRange(range, type));
      } catch (e) {
        console.log('UIValidations.ts: Error drawing infinite range', e);
      }
    }
  }

  private drawInfiniteRange(range: RefRangeBounds, type: ValidationUIType) {
    const screenRangeRectangle = getRangeRectangleFromCellRefRange(range);

    // todo...this needs to be generic for any renderer
    const visibleRectangle = pixiApp.getVisibleRectangle();
    const intersection = intersects.rectangleClip(screenRangeRectangle, visibleRectangle);
    if (!intersection) {
      return;
    }

    const sheet = sheets.sheet;
    const offsets = sheet.offsets;
    for (let row = intersection.top; row < intersection.bottom; row++) {
      const yPlacement = offsets.getRowPlacement(row);
      const y = yPlacement.position;
      for (let column = intersection.left; column < intersection.right; column++) {
        let xPlacement = offsets.getColumnPlacement(column);
        let x = xPlacement.position;
        const key = `${column},${row}`;
        // Check if UIValidation has added content to this cell or if
        // CellsTextHash has rendered content in this cell.
        if (!this.occupied.has(key) && !sheet.hasContent(column, row)) {
          if (type === 'checkbox') {
            this.addChild(
              drawCheckbox({ x: x + xPlacement.size / 2, y: y + yPlacement.size / 2, column, row, value: false })
            );
          } else if (type === 'dropdown') {
            this.addChild(
              drawDropdown({ x: x + xPlacement.size - DROPDOWN_SIZE[0] - DROPDOWN_PADDING[0], y: y, column, row })
            );
          }
          this.occupied.add(key);
        }
      }
    }
  }

  update = (viewportDirty: boolean) => {
    if (!viewportDirty && !this.dirty) return;
    if (pixiApp.viewport.scale.x < MINIMUM_SCALE_TO_SHOW_VALIDATIONS) {
      this.visible = false;
      return;
    }
    if (pixiApp.viewport.scale.x < MINIMUM_SCALE_TO_SHOW_VALIDATIONS + FADE_SCALE) {
      this.alpha = (pixiApp.viewport.scale.x - MINIMUM_SCALE_TO_SHOW_VALIDATIONS) / FADE_SCALE;
    } else {
      this.alpha = 1;
    }
    this.visible = true;
    this.dirty = false;
    this.removeChildren();
    this.occupied.clear();

    // Shortcut if there are no validations in this sheet.
    if (sheets.sheet.validations.length === 0) return;

    this.drawValidations();
  };

  // handle clicking on UI elements
  // if world is true, it skips the check and automatically triggers (reuse by pressing Space on cell)
  clickedToCell(column: number, row: number, world: Point | true) {
    const { permissions } = pixiAppSettings.editorInteractionState;
    if (!hasPermissionToEditFile(permissions)) {
      return;
    }

    this.children.forEach((child) => {
      const special = child as SpecialSprite;
      if (special.column === column && special.row === row) {
        if (special.type === 'checkbox' && (world === true || intersects.rectanglePoint(special.rectangle, world))) {
          quadraticCore.setCellValue(sheets.current, column, row, special.checkbox ? 'false' : 'true');
        } else if (
          special.type === 'dropdown' &&
          (world === true || intersects.rectanglePoint(special.rectangle, world))
        ) {
          events.emit('triggerCell', special.column, special.row, false);
        }
      }
    });
  }
}
