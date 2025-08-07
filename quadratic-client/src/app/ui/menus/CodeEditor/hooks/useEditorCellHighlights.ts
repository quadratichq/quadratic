import {
  codeEditorCellsAccessedAtom,
  codeEditorCodeCellAtom,
  codeEditorUnsavedChangesAtom,
} from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { codeCellIsAConnection } from '@/app/helpers/codeCellLanguage';
import type { JsFormulaParseResult } from '@/app/quadratic-core-types';
import { parseFormula } from '@/app/quadratic-core/quadratic_core';
import { colors } from '@/app/theme/colors';
import type { Monaco } from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';
import { useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';

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

    const onChange = () => {
      if (decorations) decorations.current?.clear();

      const cellColorReferences = new Map<string, number>();
      let newDecorations: monaco.editor.IModelDeltaDecoration[] = [];

      const modelValue = editorInst.getValue();
      if (
        codeCell.language === 'Python' ||
        codeCell.language === 'Javascript' ||
        codeCellIsAConnection(codeCell.language)
      ) {
        pixiApp.cellHighlights.fromCellsAccessed(unsavedChanges ? null : cellsAccessed, codeCell.language === 'Python');
      } else if (codeCell.language === 'Formula') {
        let parsed: JsFormulaParseResult;
        try {
          parsed = parseFormula(modelValue, sheets.jsA1Context, codeCell.sheetId, codeCell.pos.x, codeCell.pos.y);
        } catch (e) {
          console.error(e);
          return;
        }

        pixiApp.cellHighlights.fromCellsAccessed(parsed.cells_accessed, false);

        parsed.spans.forEach((span, index) => {
          const cellRef = parsed.cells_accessed[index];
          const cellId = JSON.stringify(cellRef);
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
            pixiApp.cellHighlights.setSelectedCell(index);
          }
        });

        // update the cell references in the editor
        decorations.current = editorInst.createDecorationsCollection(newDecorations);
      }
    };

    onChange();

    editorInst.onDidChangeModelContent(() => onChange());
    editorInst.onDidChangeCursorPosition(() => onChange());
  }, [
    cellsAccessed,
    codeCell.language,
    codeCell.pos.x,
    codeCell.pos.y,
    codeCell.sheetId,
    editorInst,
    isValidRef,
    monacoInst,
    unsavedChanges,
  ]);
};
