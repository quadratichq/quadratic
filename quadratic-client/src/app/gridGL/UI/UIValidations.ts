//! These are UI Validation elements that are applied to columns, rows, or all.
//! Individual cell (Selection.rects) validations are applied via the
//! CellsTextHashSpecial. Since there are "infinite", we only apply them to the
//! visible cells and redraw them whenever the viewport moves.

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { Container, Point, Rectangle } from 'pixi.js';
import { pixiApp } from '../pixiApp/PixiApp';
import { ValidationUIType, validationUIType } from '@/app/ui/menus/Validations/Validation/validationType';
import { drawCheckbox, drawDropdown, SpecialSprite } from '../cells/cellsLabel/drawSpecial';
import { pixiAppSettings } from '../pixiApp/PixiAppSettings';
import { hasPermissionToEditFile } from '@/app/actions';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { intersects } from '../helpers/intersects';

const MINIMUM_SCALE_TO_SHOW_VALIDATIONS = 0.25;
const FADE_SCALE = 0.1;

export class UIValidations extends Container<SpecialSprite> {
  dirty = true;

  private occupied: Set<string>;

  constructor() {
    super();
    this.occupied = new Set();
    events.on('sheetValidations', (sheetId: string) => {
      if (sheetId === sheets.sheet.id) {
        this.dirty = true;
      }
    });
    events.on('renderValidationWarnings', (sheetId: string) => {
      if (sheetId === sheets.sheet.id) {
        this.dirty = true;
      }
    });
  }

  // Returns the visible range of cells within the viewport.
  getVisibleRange(): Rectangle {
    const offsets = sheets.sheet.offsets;
    const bounds = pixiApp.viewport.getVisibleBounds();
    const xStart = offsets.getXPlacement(bounds.left).index;
    const xEnd = offsets.getXPlacement(bounds.right).index;
    const yStart = offsets.getYPlacement(bounds.top).index;
    const yEnd = offsets.getYPlacement(bounds.bottom).index;

    return new Rectangle(xStart, yStart, xEnd - xStart + 1, yEnd - yStart + 1);
  }

  private drawValidations(range: Rectangle) {
    // we need to take the validations in reverse order
    const validations = sheets.sheet.validations;
    for (let i = validations.length - 1; i >= 0; i--) {
      const v = validations[i];
      const type = validationUIType(v);
      if (v.selection.sheet_id.id !== sheets.sheet.id || !type) continue;

      if (v.selection.all) {
        this.drawAll(range, type);
      }
      if (v.selection.rows?.length) {
        const rows = v.selection.rows.filter((r) => r >= range.y && r <= range.y + range.height);
        rows.forEach((row) => this.drawRow(Number(row), range, type));
      }
      if (v.selection.columns?.length) {
        const columns = v.selection.columns.filter((c) => c >= range.x && c <= range.x + range.width);
        columns.forEach((column) => this.drawColumn(Number(column), range, type));
      }
    }
  }

  private drawColumn(column: number, range: Rectangle, type: ValidationUIType) {
    const offsets = sheets.sheet.offsets;
    const xPlacement = offsets.getColumnPlacement(column);
    const x = xPlacement.position;
    let yPlacement = offsets.getRowPlacement(range.y);
    let y = yPlacement.position;
    const cellsLabels = pixiApp.cellsSheets.current?.cellsLabels;
    for (let row = range.y; row < range.y + range.height; row++) {
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

      y += yPlacement.size;
      if (row !== range.y + range.height - 1) {
        yPlacement = offsets.getRowPlacement(row + 1);
      }
    }
  }

  private drawRow(row: number, range: Rectangle, type: ValidationUIType) {
    const offsets = sheets.sheet.offsets;
    const yPlacement = offsets.getRowPlacement(row);
    const y = yPlacement.position;
    let xPlacement = offsets.getColumnPlacement(range.x);
    let x = xPlacement.position;
    const cellsLabels = pixiApp.cellsSheets.current?.cellsLabels;
    for (let column = range.x; column < range.x + range.width; column++) {
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

      x += xPlacement.size;
      if (column !== range.x + range.width - 1) {
        xPlacement = offsets.getColumnPlacement(column + 1);
      }
    }
  }

  private drawAll(range: Rectangle, type: ValidationUIType) {
    const offsets = sheets.sheet.offsets;
    let xPlacement = offsets.getColumnPlacement(range.x);
    let x = xPlacement.position;
    const xStart = x;
    let yPlacement = offsets.getRowPlacement(range.y);
    let y = yPlacement.position;
    const cellsLabels = pixiApp.cellsSheets.current?.cellsLabels;
    for (let row = range.y; row < range.y + range.height; row++) {
      for (let column = range.x; column < range.x + range.width; column++) {
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

        x += xPlacement.size;
        if (column !== range.x + range.width - 1) {
          xPlacement = offsets.getColumnPlacement(column + 1);
        }
      }
      x = xStart;
      y += yPlacement.size;
      if (row !== range.y + range.height - 1) {
        yPlacement = offsets.getRowPlacement(row + 1);
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

    const range = this.getVisibleRange();
    this.drawValidations(range);
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
