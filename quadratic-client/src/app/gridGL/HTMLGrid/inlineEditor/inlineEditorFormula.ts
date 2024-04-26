import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { SheetPosTS } from '@/app/gridGL/types/size';
import { ParseFormulaReturnType } from '@/app/helpers/formulaNotation';
import { parseFormula } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { colors } from '@/app/theme/colors';
import { extractCellsFromParseFormula } from '@/app/ui/menus/CodeEditor/useEditorCellHighlights';
import * as monaco from 'monaco-editor';
import { editor } from 'monaco-editor';

class InlineEditorFormula {
  private decorations?: editor.IEditorDecorationsCollection;

  async cellHighlights(
    location: SheetPosTS,
    formula: string,
    model: editor.ITextModel,
    inlineEditor: editor.IStandaloneCodeEditor
  ) {
    const parsed = (await parseFormula(formula, location.x, location.y)) as ParseFormulaReturnType;

    if (parsed) {
      pixiApp.highlightedCells.fromFormula(parsed, { x: location.x, y: location.y }, location.sheetId);

      const extractedCells = extractCellsFromParseFormula(parsed, { x: location.x, y: location.y }, location.sheetId);
      const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];
      const cellColorReferences = new Map<string, number>();

      extractedCells.forEach((value, index) => {
        const { cellId, span } = value;
        const startPosition = model.getPositionAt(span.start);

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

        const editorCursorPosition = inlineEditor.getPosition();

        if (editorCursorPosition && range.containsPosition(editorCursorPosition)) {
          pixiApp.highlightedCells.setHighlightedCell(index);
        }
      });

      // update the cell references in the editor
      if (this.decorations) {
        this.decorations.clear();
        this.decorations.set(newDecorations);
      } else {
        this.decorations = inlineEditor.createDecorationsCollection(newDecorations);
      }
    }
  }

  clear() {
    this.decorations?.clear();
    pixiApp.highlightedCells.clear();
  }
}

export const inlineEditorFormula = new InlineEditorFormula();
