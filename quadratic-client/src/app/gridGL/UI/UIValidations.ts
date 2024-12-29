//! These are UI Validation elements that are applied to columns, rows, or all.
//! Individual cell (Selection.rects) validations are applied via the
//! CellsTextHashSpecial. Since there are "infinite", we only apply them to the
//! visible cells and redraw them whenever the viewport moves.

import { hasPermissionToEditFile } from '@/app/actions';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { drawCheckbox, drawDropdown, SpecialSprite } from '@/app/gridGL/cells/cellsLabel/drawSpecial';
import { intersects } from '@/app/gridGL/helpers/intersects';
import { getRangeRectangleFromCellRefRange } from '@/app/gridGL/helpers/selection';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { CellRefRange } from '@/app/quadratic-core-types';
import { A1SelectionToJsSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { ValidationUIType, validationUIType } from '@/app/ui/menus/Validations/Validation/validationType';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Container, Point } from 'pixi.js';

const MINIMUM_SCALE_TO_SHOW_VALIDATIONS = 0.25;
const FADE_SCALE = 0.1;

export class UIValidations extends Container<SpecialSprite> {
  dirty = true;

  private occupied: Set<string>;

  constructor() {
    super();
    this.occupied = new Set();
    events.on('sheetValidations', this.setDirty);
    events.on('renderValidationWarnings', this.setDirty);
  }

  destroy() {
    events.off('sheetValidations', this.setDirty);
    events.off('renderValidationWarnings', this.setDirty);
    super.destroy();
  }

  setDirty = (sheetId: string) => {
    if (sheetId === sheets.sheet.id) {
      this.dirty = true;
    }
  };

  private drawValidations() {
    // we need to take the validations in reverse order
    const validations = sheets.sheet.validations;
    for (let i = validations.length - 1; i >= 0; i--) {
      const v = validations[i];
      const type = validationUIType(v);
      if (v.selection.sheet_id.id !== sheets.sheet.id || !type) continue;

      try {
        const jsSelection = A1SelectionToJsSelection(v.selection, sheets.a1Context);
        const infiniteRangesStringified = jsSelection.getInfiniteRanges();
        const infiniteRanges: CellRefRange[] = JSON.parse(infiniteRangesStringified);
        infiniteRanges.forEach((range) => this.drawInfiniteRange(range, type));
      } catch (e) {
        console.log('UIValidations.ts: Error drawing infinite range', e);
      }
    }
  }

  private drawInfiniteRange(range: CellRefRange, type: ValidationUIType) {
    const screenRangeRectangle = getRangeRectangleFromCellRefRange(range);
    const visibleRectangle = sheets.getVisibleRectangle();
    const intersection = intersects.rectangleClip(screenRangeRectangle, visibleRectangle);
    if (!intersection) {
      return;
    }

    const offsets = sheets.sheet.offsets;
    const cellsLabels = pixiApp.cellsSheets.current?.cellsLabels;
    for (let row = intersection.top; row < intersection.bottom; row++) {
      const yPlacement = offsets.getRowPlacement(row);
      const y = yPlacement.position;
      for (let column = intersection.left; column < intersection.right; column++) {
        let xPlacement = offsets.getColumnPlacement(column);
        let x = xPlacement.position;
        const key = `${column},${row}`;
        // Check if UIValidation has added content to this cell or if
        // CellsTextHash has rendered content in this cell.
        if (!this.occupied.has(key) && !cellsLabels?.hasCell(column, row)) {
          if (type === 'checkbox') {
            this.addChild(
              drawCheckbox({ x: x + xPlacement.size / 2, y: y + yPlacement.size / 2, column, row, value: false })
            );
          } else if (type === 'dropdown') {
            this.addChild(drawDropdown({ x: x + xPlacement.size, y: y, column, row }));
          }
          this.occupied.add(key);
        }
      }
    }
  }

  update(viewportDirty: boolean) {
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
  }

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
          quadraticCore.setCellValue(
            sheets.sheet.id,
            column,
            row,
            special.checkbox ? 'false' : 'true',
            sheets.getCursorPosition()
          );
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
