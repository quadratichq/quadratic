import monaco from 'monaco-editor';
import { useEffect } from 'react';
import { editorHighlightedCellsStateAtom } from '../atoms/editorHighlightedCellsStateAtom';
import { CELL_REFERENCE, CELL_REFERENCE_MULTICURSOR } from '../ui/menus/CodeEditor/FormulaLanguageModel';
import { useSetRecoilState } from 'recoil';
import { colors } from '../theme/colors';

function compareOldToNewMatches(oldCellsMatches: CellMatch, cellsMatches: CellMatch): boolean {
  if (oldCellsMatches.size !== cellsMatches.size) return false;

  for (const item of oldCellsMatches.keys()) {
    if (!cellsMatches.has(item)) return false;
  }

  return true;
}

// formulaNotation, range
export type CellMatch = Map<string, monaco.Range>;

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

    const onChangeModel = () => {
      const cellColorReferences = new Map<string, number>();
      let newDecorations: monaco.editor.IModelDeltaDecoration[] = [];

      const cellsMatches: CellMatch = new Map();
      const tokens = monacoInst.editor.tokenize(editor.getValue(), 'formula');

      for (let lineTokens = 0; lineTokens < tokens.length; lineTokens++) {
        const lineNumber = lineTokens + 1;
        const lineContent = model.getLineContent(lineNumber);
        for (let i = 0; i < tokens[lineTokens].length; i++) {
          const startColumnNumber = tokens[lineTokens][i].offset;
          const endColumnNumber = tokens[lineTokens][i + 1]?.offset ?? lineContent.length;

          const tokenType = tokens[lineTokens][i].type;

          if (tokenType !== `${CELL_REFERENCE}.formula` && tokenType !== `${CELL_REFERENCE_MULTICURSOR}.formula`)
            continue;

          const tokenText = lineContent.substring(startColumnNumber, endColumnNumber);
          const cellColor =
            cellColorReferences.get(tokenText) ?? cellColorReferences.size % colors.cellHighlightColor.length;
          cellColorReferences.set(tokenText, cellColor);

          const range = new monacoInst.Range(
            lineNumber,
            startColumnNumber === 0 ? 0 : startColumnNumber + 1,
            lineNumber,
            endColumnNumber + 1
          );

          newDecorations.push({
            range,
            options: {
              stickiness: 1,
              inlineClassName: `cell-reference-${cellColorReferences.get(tokenText)}`,
            },
          });
          cellsMatches.set(tokenText, range);
        }
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
      setEditorHighlightedCells(({ selectedCell }) => ({
        highlightedCells: cellsMatches,
        selectedCell,
      }));
    }

    return () => editor.dispose();
  }, [isValidRef, editorRef, monacoRef, setEditorHighlightedCells]);
};
