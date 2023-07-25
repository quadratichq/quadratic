import monaco from 'monaco-editor';
import { useEffect } from 'react';
import { useSetRecoilState } from 'recoil';
import { editorHighlightedCellsStateAtom } from '../atoms/editorHighlightedCellsStateAtom';
import { ParseFormulaReturnType, Span } from '../helpers/formulaNotation';
import { StringId, getKey } from '../helpers/getKey';
import { parse_formula } from '../quadratic-core/quadratic_core';
import { colors } from '../theme/colors';

function compareOldToNewMatches(oldCellsMatches: CellMatch, cellsMatches: CellMatch): boolean {
  if (oldCellsMatches.size !== cellsMatches.size) return false;

  for (const [cellRefId, range] of oldCellsMatches.entries()) {
    const newRange = cellsMatches.get(cellRefId);
    if (!newRange || !range.equalsRange(newRange)) return false;
  }

  return true;
}

function extractCellsFromParseFormula(parsedFormula: ParseFormulaReturnType): { cellId: CellRefId; span: Span }[] {
  return parsedFormula.cell_refs.map(({ cell_ref, span }) => {
    if ('Cell' in cell_ref) return { cellId: getKey(cell_ref.Cell.x.Relative, cell_ref.Cell.y.Relative), span };
    return {
      cellId: `${getKey(cell_ref.CellRange[0].x.Relative, cell_ref.CellRange[0].y.Relative)}:${getKey(
        cell_ref.CellRange[1].x.Relative,
        cell_ref.CellRange[1].y.Relative
      )}`,
      span,
    };
  });
}

export type CellRefId = StringId | `${StringId}:${StringId}`;

export type CellMatch = Map<CellRefId, monaco.Range>;

export const useEditorCellHighlights = (
  isValidRef: boolean,
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>,
  monacoRef: React.MutableRefObject<typeof monaco | null>
) => {
  const setEditorHighlightedCells = useSetRecoilState(editorHighlightedCellsStateAtom);

  // Dynamically generate the classnames we'll use for cell references by pulling
  // the colors from the same colors used in pixi and stick them in the DOM
  useEffect(() => {
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
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    const monacoInst = monacoRef.current;
    if (!isValidRef || !editor || !monacoInst) return;

    const model = editor.getModel();

    if (!model) return;

    let oldDecorations: string[] = [];
    let oldCellsMatches: CellMatch = new Map();
    let selectedCell: string;
    const onChangeModel = async () => {
      const cellColorReferences = new Map<string, number>();
      let newDecorations: monaco.editor.IModelDeltaDecoration[] = [];
      const cellsMatches: CellMatch = new Map();

      const modelValue = editor.getValue();

      const parsedFormula = (await parse_formula(modelValue, 0, 0)) as ParseFormulaReturnType;

      const extractedCells = extractCellsFromParseFormula(parsedFormula);

      for (const { cellId, span } of extractedCells) {
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
        if (editorCursorPosition && range.containsPosition(editorCursorPosition)) selectedCell = cellId;
      }

      const decorationsIds = editor.deltaDecorations(oldDecorations, newDecorations);
      setStateOnChangedMatches(oldCellsMatches, cellsMatches);

      oldDecorations = decorationsIds;
      oldCellsMatches = cellsMatches;
    };

    onChangeModel();
    editor.onDidChangeModelContent(onChangeModel);

    function setStateOnChangedMatches(oldCellsMatches: CellMatch, cellsMatches: CellMatch) {
      // setting the state on each interaction takes too long and makes the input laggy
      if (compareOldToNewMatches(oldCellsMatches, cellsMatches)) return;
      setEditorHighlightedCells({ highlightedCells: cellsMatches, selectedCell });
    }

    return () => editor.dispose();
  }, [isValidRef, editorRef, monacoRef, setEditorHighlightedCells]);
};
