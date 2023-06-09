import monaco from 'monaco-editor';
import { useEffect } from 'react';
import { SetterOrUpdater } from 'recoil';
import { EditorInteractionState } from '../atoms/editorInteractionStateAtom';
import { CELL_REFERENCE, CELL_REFERENCE_MULTICURSOR } from '../ui/menus/CodeEditor/FormulaLanguageModel';

function compareSets(oldCellsMatches: Set<string>, cellsMatches: Set<string>): boolean {
  if (oldCellsMatches.size !== cellsMatches.size) return false;

  for (const item of oldCellsMatches) {
    if (!cellsMatches.has(item)) return false;
  }

  return true;
}

export const useEditorCellHighlights = (
  isValidRef: boolean,
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>,
  monacoRef: React.MutableRefObject<typeof monaco | null>,
  setInteractionState: SetterOrUpdater<EditorInteractionState>
) => {
  useEffect(() => {
    const editor = editorRef.current;
    const monacoInst = monacoRef.current;
    if (!isValidRef || !editor || !monacoInst) return;

    const model = editor.getModel();

    if (!model) return;

    let oldDecorations: string[] = [];
    let oldCellsMatches: Set<string> = new Set();

    const changeModelContent = () => {
      const cellColorReferences = new Map<string, number>();
      let newDecorations: monaco.editor.IModelDeltaDecoration[] = [];
      const cellsMatches: Set<string> = new Set();
      const tokens = monacoInst.editor.tokenize(editor.getValue(), 'formula');

      for (let lineTokens = 0; lineTokens < tokens.length; lineTokens++) {
        const lineContent = model.getLineContent(lineTokens + 1);
        for (let i = 0; i < tokens[lineTokens].length; i++) {
          const startLineNumber = tokens[lineTokens][i].offset;
          const endLineNumber = tokens[lineTokens][i + 1]?.offset ?? lineContent.length;

          const tokenType = tokens[lineTokens][i].type;

          if (tokenType !== `${CELL_REFERENCE}.formula` && tokenType !== `${CELL_REFERENCE_MULTICURSOR}.formula`)
            continue;

          const tokenText = lineContent.substring(startLineNumber, endLineNumber);
          const cellColor = cellColorReferences.get(tokenText) ?? cellColorReferences.size % 10;
          cellColorReferences.set(tokenText, cellColor);

          newDecorations.push({
            range: new monacoInst.Range(
              lineTokens + 1,
              startLineNumber === 0 ? 0 : startLineNumber + 1,
              lineTokens + 1,
              endLineNumber + 1
            ),
            options: {
              stickiness: 1,
              inlineClassName: `cell-reference-${cellColorReferences.get(tokenText)}`,
            },
          });
          cellsMatches.add(tokenText);
        }
      }

      const decorationsIds = editor.deltaDecorations(oldDecorations, newDecorations);
      setStateOnChangedMatches(oldCellsMatches, cellsMatches);

      oldDecorations = decorationsIds;
      oldCellsMatches = cellsMatches;
    };
    changeModelContent();
    editor.onDidChangeModelContent(changeModelContent);
    function setStateOnChangedMatches(oldCellsMatches: Set<string>, cellsMatches: Set<string>) {
      // setting the state on each interaction takes too long and makes the input laggy
      if (compareSets(oldCellsMatches, cellsMatches)) return;

      setInteractionState((editorInteractionState) => ({
        ...editorInteractionState,
        ...{ showCodeEditor: true, highlightedCells: cellsMatches },
      }));
    }

    return () => editor.dispose();
  }, [setInteractionState, isValidRef, editorRef, monacoRef]);
};
