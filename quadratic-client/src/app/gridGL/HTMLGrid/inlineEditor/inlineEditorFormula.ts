//! This handles the cell highlighting and inserting of cells when editing a
//! formula in the inline editor.

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { inlineEditorKeyboard } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorKeyboard';
import { inlineEditorMonaco } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { SheetPosTS } from '@/app/gridGL/types/size';
import { ParseFormulaReturnType } from '@/app/helpers/formulaNotation';
import { checkFormula, parseFormula, posToA1 } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { colors } from '@/app/theme/colors';
import { extractCellsFromParseFormula } from '@/app/ui/menus/CodeEditor/useEditorCellHighlights';
import * as monaco from 'monaco-editor';
import { editor } from 'monaco-editor';

class InlineEditorFormula {
  private insertingCells?: { value: string; position: number };
  private decorations?: editor.IEditorDecorationsCollection;

  constructor() {
    events.on('cursorPosition', this.cursorMoved);
  }

  async cellHighlights(location: SheetPosTS, formula: string) {
    const parsed = (await parseFormula(formula, location.x, location.y)) as ParseFormulaReturnType;
    if (parsed) {
      pixiApp.cellHighlights.fromFormula(parsed, { x: location.x, y: location.y }, location.sheetId);

      const extractedCells = extractCellsFromParseFormula(parsed, { x: location.x, y: location.y }, location.sheetId);
      const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];
      const cellColorReferences = new Map<string, number>();

      extractedCells.forEach((value, index) => {
        const { cellId, span } = value;
        const startPosition = inlineEditorMonaco.getSpanPosition(span.start);

        const cellColor =
          cellColorReferences.get(cellId) ?? cellColorReferences.size % colors.cellHighlightColor.length;
        cellColorReferences.set(cellId, cellColor);

        // we need to +1 since we removed the `=` character from the formula
        const range = new monaco.Range(
          startPosition.lineNumber,
          startPosition.column + 1,
          startPosition.lineNumber,
          startPosition.column + 1 + span.end - span.start
        );

        // decorations color the cell references in the editor
        newDecorations.push({
          range,
          options: {
            stickiness: 1,
            inlineClassName: `cell-reference-${cellColorReferences.get(cellId)}`,
          },
        });

        const editorCursorPosition = inlineEditorMonaco.getPosition();

        if (editorCursorPosition && range.containsPosition(editorCursorPosition)) {
          pixiApp.cellHighlights.setHighlightedCell(index);
        }
      });

      // update the cell references in the editor
      if (this.decorations) {
        this.decorations.clear();
        this.decorations.set(newDecorations);
      } else {
        this.decorations = inlineEditorMonaco.createDecorationsCollection(newDecorations);
      }
    } else {
      this.clearDecorations();
    }
  }

  clearDecorations() {
    this.decorations?.clear();
    pixiApp.cellHighlights.clear();
  }

  removeInsertingCells() {
    if (!this.insertingCells) return;
    const { value, position } = this.insertingCells;
    inlineEditorMonaco.deleteText(position, value.length);
    this.insertingCells = undefined;
  }

  private insertInsertingCells(a1Notation: string) {
    this.removeInsertingCells();
    const position = inlineEditorMonaco.insertTextAtCursor(a1Notation);
    this.insertingCells = { value: a1Notation, position };
  }

  addInsertingCells(position: number) {
    this.insertingCells = { value: '', position };
  }

  endInsertingCells() {
    this.insertingCells = undefined;
  }

  // Handle the cursorPosition event (and changeSheet via inlineEditorHandler.changeSheet).
  cursorMoved = () => {
    if (inlineEditorHandler.cursorIsMoving) {
      const cursor = sheets.sheet.cursor;

      const location = inlineEditorHandler.location;
      if (!location) {
        throw new Error('Expected inlineEditorHandler.location to be defined in cursorMoved');
      }

      // We start the cursorIsMoving unless we've returned to the home cell from
      // a Backspace or Escape key.
      if (inlineEditorKeyboard.escapeBackspacePressed) return;

      inlineEditorHandler.cursorIsMoving = true;
      inlineEditorMonaco.removeSelection();
      let sheet = '';
      if (location.sheetId !== sheets.sheet.id) {
        sheet = `'${sheets.sheet.name}'!`;
      }
      if (cursor.multiCursor) {
        let coords = '';
        cursor.multiCursor.forEach((c, i) => {
          const start = posToA1(c.left, c.top);
          const end = posToA1(c.right - 1, c.bottom - 1);
          coords += `${start}:${end}${i !== cursor.multiCursor!.length - 1 ? ',' : ''}`;
        });
        this.insertInsertingCells(`${sheet}${coords}`);
      } else {
        const location = cursor.getCursor();
        const a1Notation = posToA1(location.x, location.y);
        this.insertInsertingCells(`${sheet}${a1Notation}`);
      }

      inlineEditorHandler.sendMultiplayerUpdate();

      // We need the timeout to ensure the pointerDown event does not change the
      // focus again.
      setTimeout(inlineEditorMonaco.focus, 0);
    }
  };

  // Returns whether a cell references is likely to be a valid token at the
  // cursor position. This is useful for determining whether the user intends to
  // insert a cell reference when they select a different cell (either by click
  // or by keyboard input) or whether they want to switch to a different cell.
  wantsCellRef() {
    const lastCharacter = inlineEditorMonaco.getNonWhitespaceCharBeforeCursor();
    return ['', ',', '+', '-', '*', '/', '%', '=', '<', '>', '&', '.', '(', '{'].includes(lastCharacter);
  }

  // Returns whether we are editing a formula only if it is valid (used for
  // PointerDown checks to differentiate between selecting a cell and closing
  // the inline formula editor). Also checks if there is a selection (which will
  // be replaced by pointer down).
  isFormulaValid(testFormula?: string, skipCloseParenthesisCheck?: true): boolean {
    if (inlineEditorHandler.cursorIsMoving) return false;
    if (inlineEditorMonaco.hasSelection()) return false;

    const location = inlineEditorHandler.location;
    if (!location) return false;
    const formula = (testFormula ?? inlineEditorMonaco.get()).slice(1);
    if (!checkFormula(formula, location.x, location.y)) {
      if (skipCloseParenthesisCheck) {
        return false;
      }
      const value = this.closeParentheses();
      if (value && value !== testFormula) {
        return checkFormula(value, location.x, location.y);
      } else {
        return false;
      }
    } else {
      return true;
    }
  }

  closeParentheses(): string | undefined {
    let formula = inlineEditorMonaco.get();
    let count = 0;
    for (let i = 0; i < formula.length; i++) {
      if (formula[i] === '(') {
        count++;
      } else if (formula[i] === ')') {
        count--;
      }
    }
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        formula += ')';
      }
      if (this.isFormulaValid(formula, true)) {
        inlineEditorMonaco.set(formula);
        return formula;
      } else {
        return undefined;
      }
    }
    return formula;
  }
}

export const inlineEditorFormula = new InlineEditorFormula();
