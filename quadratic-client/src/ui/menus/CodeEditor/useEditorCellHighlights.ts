import { parsePython } from '@/helpers/parseEditorPythonCell';
import { CodeCellLanguage } from '@/quadratic-core/types';
import monaco, { editor } from 'monaco-editor';
import { useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { pixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { ParseFormulaReturnType, Span } from '../../../helpers/formulaNotation';
import { StringId, getKey } from '../../../helpers/getKey';
import { parse_formula } from '../../../quadratic-core/quadratic_core';
import { colors } from '../../../theme/colors';

function extractCellsFromParseFormula(
  parsedFormula: ParseFormulaReturnType
): { cellId: CellRefId; span: Span; index: number }[] {
  return parsedFormula.cell_refs.map(({ cell_ref, span }, index) => {
    if (cell_ref.type === 'CellRange') {
      if (cell_ref.start.x.type !== 'Relative' || cell_ref.end.x.type !== 'Relative') {
        throw new Error('Unhandled non-Relative type in extractCellsFromParseFormula');
      }
      return {
        cellId: `${getKey(cell_ref.start.x.coord, cell_ref.start.y.coord)}:${getKey(
          cell_ref.end.x.coord,
          cell_ref.end.y.coord
        )}`,
        span,
        index,
      };
    } else if (cell_ref.type === 'Cell') {
      return { cellId: getKey(cell_ref.pos.x.coord, cell_ref.pos.y.coord), span, index };
    } else {
      throw new Error('Unhandled cell_ref type in extractCellsFromParseFormula');
    }
  });
}

export type CellRefId = StringId | `${StringId}:${StringId}`;
export type CellMatch = Map<CellRefId, monaco.Range>;

export const useEditorCellHighlights = (
  isValidRef: boolean,
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>,
  monacoRef: React.MutableRefObject<typeof monaco | null>,
  language?: CodeCellLanguage
) => {
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  let decorations = useRef<editor.IEditorDecorationsCollection | undefined>(undefined);

  // Dynamically generate the classnames we'll use for cell references by pulling
  // the colors from the same colors used in pixi and stick them in the DOM
  useEffect(() => {
    if (language !== 'Formula') return;

    const id = 'useEditorCellHighlights';

    if (!document.querySelector(id)) {
      const style = document.createElement('style');
      document.head.appendChild(style);
      style.id = id;
      style.type = 'text/css';
      style.appendChild(
        document.createTextNode(
          colors.cellHighlightColor.map((color, i) => `.cell-reference-${i} { color: ${color} !important }`).join('')
        )
      );
    }
  }, [language]);

  useEffect(() => {
    // if (language !== 'Formula') return;
    const editor = editorRef.current;
    const monacoInst = monacoRef.current;
    if (!isValidRef || !editor || !monacoInst) return;

    const model = editor.getModel();

    if (!model) return;

    const onChangeModel = async () => {
      if (decorations) decorations.current?.clear();

      const cellColorReferences = new Map<string, number>();
      let newDecorations: monaco.editor.IModelDeltaDecoration[] = [];
      const cellsMatches: CellMatch = new Map();

      const modelValue = editor.getValue();
      let parsed;

      if (language === 'Python') {
        parsed = parsePython(modelValue) as ParseFormulaReturnType;
      }

      if (language === 'Formula') {
        parsed = (await parse_formula(modelValue, 0, 0)) as ParseFormulaReturnType;
      }

      if (parsed) {
        pixiApp.highlightedCells.fromFormula(
          parsed,
          editorInteractionState.selectedCell,
          editorInteractionState.selectedCellSheet
        );

        const extractedCells = extractCellsFromParseFormula(parsed);

        extractedCells.forEach((value, index) => {
          const { cellId, span } = value;
          const startPosition = model.getPositionAt(span.start);

          const cellColor =
            cellColorReferences.get(cellId) ?? cellColorReferences.size % colors.cellHighlightColor.length;
          cellColorReferences.set(cellId, cellColor);

          const range = new monacoInst.Range(
            startPosition.lineNumber,
            startPosition.column,
            startPosition.lineNumber,
            startPosition.column + span.end - span.start
          );

          newDecorations.push({
            range,
            options: {
              stickiness: 1,
              inlineClassName: `cell-reference-${cellColorReferences.get(cellId)}`,
            },
          });

          cellsMatches.set(cellId, range);

          const editorCursorPosition = editor.getPosition();

          if (editorCursorPosition && range.containsPosition(editorCursorPosition)) {
            pixiApp.highlightedCells.setHighlightedCell(index);
          }
        });

        decorations.current = editorRef.current?.createDecorationsCollection(newDecorations);
      }
    };

    onChangeModel();
    editor.onDidChangeModelContent(onChangeModel);
  }, [
    isValidRef,
    editorRef,
    monacoRef,
    editorInteractionState.selectedCell,
    editorInteractionState.selectedCellSheet,
    language,
  ]);
};
