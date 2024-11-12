import 'monaco-editor';
import DefaultEditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonEditorWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import TsEditorWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// This is where we globally define worker types for Monaco. See
// https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-esm.md
window.MonacoEnvironment = {
  getWorker(_, label) {
    switch (label) {
      case 'typescript':
      case 'javascript':
        return new TsEditorWorker({ name: label });
      case 'json':
        return new JsonEditorWorker({ name: label });
      default:
        return new DefaultEditorWorker({ name: label });
    }
  },
};
