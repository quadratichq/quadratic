import { codeEditorLanguageAtom } from '@/app/atoms/codeEditorAtom';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useEffect } from 'react';
import { useRecoilValue } from 'recoil';

export const useEditorOnSelectionChange = (
  isValidRef: boolean,
  editorInst: monaco.editor.IStandaloneCodeEditor | null,
  monacoInst: Monaco | null
) => {
  const language = useRecoilValue(codeEditorLanguageAtom);
  useEffect(() => {
    if (language !== 'Formula') return;

    if (!isValidRef || !editorInst || !monacoInst) return;

    const model = editorInst.getModel();
    if (!model) return;

    editorInst.onDidChangeCursorPosition((e) => {
      pixiApp.cellHighlights.getHighlightedCells().find((value) => {
        const span = value.span;
        const startPosition = model.getPositionAt(span.start);
        const endPosition = model.getPositionAt(span.end);
        const range = new monacoInst.Range(
          startPosition.lineNumber,
          startPosition.column,
          endPosition.lineNumber,
          endPosition.column
        );

        if (range.containsPosition(e.position)) {
          pixiApp.cellHighlights.setHighlightedCell(value.index);
          return true;
        }

        pixiApp.cellHighlights.setHighlightedCell(-1);

        return false;
      });
    });
  }, [isValidRef, editorInst, monacoInst, language]);
};
