import { Monaco } from '@monaco-editor/react';
import monaco from 'monaco-editor';
import { useRef } from 'react';

export function useCodeEditorRef() {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  return { editorRef, monacoRef };
}
