import {
  codeEditorCellsAccessedAtom,
  codeEditorCodeCellAtom,
  codeEditorUnsavedChangesAtom,
} from '@/app/atoms/codeEditorAtom';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { codeCellIsAConnection } from '@/app/helpers/codeCellLanguage';
import { parseFormulaReturnToCellsAccessed, ParseFormulaReturnType } from '@/app/helpers/formulaNotation';
import { getKey, StringId } from '@/app/helpers/getKey';
import { JsCoordinate, Span } from '@/app/quadratic-core-types';
import { parseFormula } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { colors } from '@/app/theme/colors';
import { Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';

export function extractCellsFromParseFormula(
  parsedFormula: ParseFormulaReturnType,
  cell: JsCoordinate
): { cellId: CellRefId; span: Span; index: number }[] {
  return parsedFormula.cell_refs.map(({ cell_ref, span }, index) => {
    if (cell_ref.type === 'CellRange') {
      const startX = pixiApp.cellHighlights.evalCoord(cell_ref.start.x, cell.x) + cell_ref.start.x.coord;
      const startY = pixiApp.cellHighlights.evalCoord(cell_ref.start.y, cell.y) + cell_ref.start.y.coord;
      const endX = pixiApp.cellHighlights.evalCoord(cell_ref.end.x, cell.x) + cell_ref.end.x.coord;
      const endY = pixiApp.cellHighlights.evalCoord(cell_ref.end.y, cell.y) + cell_ref.end.y.coord;

      return {
        cellId: `${getKey(startX, startY)}:${getKey(endX, endY)}`,
        span,
        index,
      };
    } else if (cell_ref.type === 'Cell') {
      const x = pixiApp.cellHighlights.evalCoord(cell_ref.pos.x, cell.x) + cell_ref.pos.x.coord;
      const y = pixiApp.cellHighlights.evalCoord(cell_ref.pos.y, cell.y) + cell_ref.pos.y.coord;
      return { cellId: getKey(x, y), span, index };
    } else {
      throw new Error('Unhandled cell_ref type in extractCellsFromParseFormula');
    }
  });
}

export type CellRefId = StringId | `${StringId}:${StringId}`;
export type CellMatch = Map<CellRefId, monaco.Range>;

export const createFormulaStyleHighlights = () => {
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
};

export const useEditorCellHighlights = (
  isValidRef: boolean,
  editorInst: monaco.editor.IStandaloneCodeEditor | null,
  monacoInst: Monaco | null
) => {
  const codeCell = useRecoilValue(codeEditorCodeCellAtom);
  const cellsAccessed = useRecoilValue(codeEditorCellsAccessedAtom);
  const unsavedChanges = useRecoilValue(codeEditorUnsavedChangesAtom);
  const decorations = useRef<monaco.editor.IEditorDecorationsCollection | undefined>(undefined);

  // Dynamically generate the classnames we'll use for cell references by pulling
  // the colors from the same colors used in pixi and stick them in the DOM
  useEffect(() => {
    if (codeCell.language !== 'Formula') return;
    createFormulaStyleHighlights();
  }, [codeCell.language]);

  useEffect(() => {
    if (!isValidRef || !editorInst || !monacoInst) return;

    const model = editorInst.getModel();
    if (!model) return;

    const onChangeModel = () => {
      if (decorations) decorations.current?.clear();

      const cellColorReferences = new Map<string, number>();
      let newDecorations: monaco.editor.IModelDeltaDecoration[] = [];

      const modelValue = editorInst.getValue();
      if (
        codeCell.language === 'Python' ||
        codeCell.language === 'Javascript' ||
        codeCellIsAConnection(codeCell.language)
      ) {
        pixiApp.cellHighlights.fromCellsAccessed(unsavedChanges ? null : cellsAccessed);
      } else if (codeCell.language === 'Formula') {
        const parsed = JSON.parse(parseFormula(modelValue, codeCell.pos.x, codeCell.pos.y)) as ParseFormulaReturnType;
        if (parsed) {
          const cellsAccessed = parseFormulaReturnToCellsAccessed(parsed, codeCell.pos, codeCell.sheetId);
          pixiApp.cellHighlights.fromCellsAccessed(cellsAccessed);
          const extractedCells = extractCellsFromParseFormula(parsed, codeCell.pos);
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

            // decorations color the cell references in the editor
            newDecorations.push({
              range,
              options: {
                stickiness: 1,
                inlineClassName: `cell-reference-${cellColorReferences.get(cellId)}`,
              },
            });

            const editorCursorPosition = editorInst.getPosition();

            if (editorCursorPosition && range.containsPosition(editorCursorPosition)) {
              pixiApp.cellHighlights.setHighlightedCell(index);
            }
          });

          // update the cell references in the editor
          decorations.current = editorInst.createDecorationsCollection(newDecorations);
        }
      }
    };

    onChangeModel();
    editorInst.onDidChangeModelContent(() => onChangeModel());
  }, [
    cellsAccessed,
    codeCell.language,
    codeCell.pos,
    codeCell.sheetId,
    editorInst,
    isValidRef,
    monacoInst,
    unsavedChanges,
  ]);
};
