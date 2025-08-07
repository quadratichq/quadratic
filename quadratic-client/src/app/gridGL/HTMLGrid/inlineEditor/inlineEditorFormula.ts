//! This handles the cell highlighting and inserting of cells when editing a
//! formula in the inline editor.

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { inlineEditorMonaco } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorMonaco';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { JsFormulaParseResult } from '@/app/quadratic-core-types';
import { checkFormula, parseFormula, toggleReferenceTypes } from '@/app/quadratic-core/quadratic_core';
import type { SheetPosTS } from '@/app/shared/types/size';
import { colors } from '@/app/theme/colors';
import type { editor } from 'monaco-editor';
import * as monaco from 'monaco-editor';

class InlineEditorFormula {
  private insertingCells?: { value: string; position: number };
  private decorations?: editor.IEditorDecorationsCollection;

  constructor() {
    events.on('cursorPosition', this.cursorMoved);
  }

  cellHighlights(location: SheetPosTS, formula: string) {
    let parseResult: JsFormulaParseResult;
    try {
      parseResult = parseFormula(formula, sheets.jsA1Context, location.sheetId, location.x, location.y);
    } catch (e) {
      this.clearDecorations();
      return;
    }
    pixiApp.cellHighlights.fromCellsAccessed(parseResult.cells_accessed, false);

    const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];
    const cellColorReferences = new Map<string, number>();

    parseResult.spans.forEach((span, index) => {
      const startPosition = inlineEditorMonaco.getSpanPosition(span.start);

      const cellRef = parseResult.cells_accessed[index];
      const cellId = JSON.stringify(cellRef);
      const cellColor = cellColorReferences.get(cellId) ?? cellColorReferences.size % colors.cellHighlightColor.length;
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
        pixiApp.cellHighlights.setSelectedCell(index);
      }
    });

    // update the cell references in the editor
    if (this.decorations) {
      this.decorations.clear();
      this.decorations.set(newDecorations);
    } else {
      this.decorations = inlineEditorMonaco.createDecorationsCollection(newDecorations);
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

      inlineEditorHandler.cursorIsMoving = true;
      inlineEditorMonaco.removeSelection();
      this.insertInsertingCells(cursor.toA1String(inlineEditorHandler.location?.sheetId));

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
    return (
      !!lastCharacter &&
      ['', ',', '+', '-', '*', '/', '%', '=', '<', '>', '&', '.', '(', '{', ':', '!'].includes(lastCharacter)
    );
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
    if (!checkFormula(formula, sheets.jsA1Context, location.sheetId, location.x, location.y)) {
      if (skipCloseParenthesisCheck) {
        return false;
      }
      const value = this.closeParentheses();
      if (value && value !== testFormula) {
        return checkFormula(value, sheets.jsA1Context, location.sheetId, location.x, location.y);
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

  toggleReference() {
    const reference = inlineEditorMonaco.getReferenceAtCursor();
    if (!reference) return;
    try {
      const newReference = toggleReferenceTypes(reference.text);
      inlineEditorMonaco.replaceRange(newReference, reference.range);
    } catch (e) {
      // the reference is not valid, so we do nothing
    }
  }
}

export const inlineEditorFormula = new InlineEditorFormula();
