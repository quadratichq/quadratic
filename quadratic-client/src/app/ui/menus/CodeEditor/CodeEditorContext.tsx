import { Coordinate } from '@/app/gridGL/types/size';
import { PanelTab } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanelBottom';
import { EvaluationResult } from '@/app/web-workers/pythonWebWorker/pythonTypes';
import { Monaco } from '@monaco-editor/react';
import monaco from 'monaco-editor';
import React, { createContext, useContext, useRef, useState } from 'react';

type Context = {
  // `undefined` is used here as a loading state. Once the editor mounts, it becomes a string (possibly empty)
  codeString: [string | undefined, React.Dispatch<React.SetStateAction<string | undefined>>];
  consoleOutput: [
    { stdOut?: string; stdErr?: string } | undefined,
    React.Dispatch<React.SetStateAction<{ stdOut?: string; stdErr?: string } | undefined>>
  ];
  editorContent: [string | undefined, React.Dispatch<React.SetStateAction<string | undefined>>];
  evaluationResult: [EvaluationResult | undefined, React.Dispatch<React.SetStateAction<EvaluationResult | undefined>>];
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>;
  monacoRef: React.MutableRefObject<Monaco | null>;
  panelBottomActiveTab: [PanelTab, React.Dispatch<React.SetStateAction<PanelTab>>];
  showSnippetsPopover: [boolean, React.Dispatch<React.SetStateAction<boolean>>];
  spillError: [Coordinate[] | undefined, React.Dispatch<React.SetStateAction<Coordinate[] | undefined>>];
  modifiedEditorContent: [string | undefined, React.Dispatch<React.SetStateAction<string | undefined>>];
};

const CodeEditorContext = createContext<Context>({
  codeString: [undefined, () => {}],
  consoleOutput: [undefined, () => {}],
  editorContent: [undefined, () => {}],
  editorRef: { current: null },
  evaluationResult: [undefined, () => {}],
  monacoRef: { current: null },
  panelBottomActiveTab: ['console', () => {}],
  showSnippetsPopover: [false, () => {}],
  spillError: [undefined, () => {}],
  modifiedEditorContent: [undefined, () => {}],
});

export const CodeEditorProvider = ({ children }: { children: React.ReactNode }) => {
  const codeString = useState<Context['codeString'][0]>(undefined); // update code cell
  const consoleOutput = useState<Context['consoleOutput'][0]>(undefined);
  const editorContent = useState<Context['editorContent'][0]>(codeString[0]);
  const editorRef = useRef<Context['editorRef']['current']>(null);
  const evaluationResult = useState<Context['evaluationResult'][0]>(undefined);
  const monacoRef = useRef<Context['monacoRef']['current']>(null);
  const panelBottomActiveTab = useState<PanelTab>('console');
  const showSnippetsPopover = useState<Context['showSnippetsPopover'][0]>(false);
  const spillError = useState<Context['spillError'][0]>(undefined);
  const modifiedEditorContent = useState<Context['modifiedEditorContent'][0]>(undefined);
  return (
    <CodeEditorContext.Provider
      value={{
        consoleOutput,
        codeString,
        editorRef,
        editorContent,
        evaluationResult,
        monacoRef,
        panelBottomActiveTab,
        showSnippetsPopover,
        spillError,
        modifiedEditorContent,
      }}
    >
      {children}
    </CodeEditorContext.Provider>
  );
};

export const useCodeEditor = () => useContext(CodeEditorContext);
