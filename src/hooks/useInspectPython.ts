import monaco, { Range } from 'monaco-editor';
import { useEffect, useState } from 'react';
import { Cell, CellType } from '../schemas';
import { InspectPythonReturnType } from '../web-workers/pythonWebWorker/pythonTypes';
import { webWorkers } from '../web-workers/webWorkers';

const useInspectPython = (
  editorContent: string | undefined,
  setReturnSelection: (selection: InspectPythonReturnType | undefined) => void,
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>,
  editorMode: CellType,
  selectedCell: Cell | undefined
) => {
  const [oldDecorations, setOldDecorations] = useState<string[]>([]);
  useEffect(() => {
    (async function () {
      if (editorMode !== 'PYTHON') return;
      if (!editorContent) return setReturnSelection(undefined);
      const pythonReturnTypes = await webWorkers.inspectPythonReturnType(editorContent);
      setReturnSelection(pythonReturnTypes);
      // If syntax error or no editor we cannot highlight
      if (!editorRef.current || 'error' in pythonReturnTypes) return;
      const range = new Range(
        pythonReturnTypes.lineno,
        pythonReturnTypes.col_offset,
        pythonReturnTypes.end_lineno,
        pythonReturnTypes.end_col_offset + 1
      );
      const options = {
        stickiness: 1,
        isWholeLine: false,
        className: 'codeEditorReturnHighlight',
      };
      const decorationIds = editorRef.current.deltaDecorations(oldDecorations, [{ range, options }]);
      setOldDecorations(decorationIds);
    })();
  }, [editorContent, selectedCell]);
};

export default useInspectPython;
