import type { Monaco } from '@monaco-editor/react';
import type monaco from 'monaco-editor';
import React, { createContext, useContext, useRef, useState } from 'react';

import type { Coordinate } from '@/app/gridGL/types/size';
import type { AiMessage } from '@/app/ui/menus/CodeEditor/AiAssistant';
import { CodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditor';
import type { PanelTab } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanelBottom';
import type { EvaluationResult } from '@/app/web-workers/pythonWebWorker/pythonTypes';

type Context = {
  aiAssistant: {
    controllerRef: React.MutableRefObject<AbortController | null>;
    loading: [boolean, React.Dispatch<React.SetStateAction<boolean>>];
    messages: [AiMessage[], React.Dispatch<React.SetStateAction<AiMessage[]>>];
    prompt: [string, React.Dispatch<React.SetStateAction<string>>];
  };
  codeString: [string, React.Dispatch<React.SetStateAction<string>>];
  consoleOutput: [
    { stdOut?: string; stdErr?: string } | undefined,
    React.Dispatch<React.SetStateAction<{ stdOut?: string; stdErr?: string } | undefined>>
  ];
  // containerRef: React.RefObject<HTMLDivElement>;
  editorContent: [string | undefined, React.Dispatch<React.SetStateAction<string | undefined>>];
  evaluationResult: [EvaluationResult | undefined, React.Dispatch<React.SetStateAction<EvaluationResult | undefined>>];
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>;
  monacoRef: React.MutableRefObject<Monaco | null>;
  panelBottomActiveTab: [PanelTab, React.Dispatch<React.SetStateAction<PanelTab>>];
  showSnippetsPopover: [boolean, React.Dispatch<React.SetStateAction<boolean>>];
  spillError: [Coordinate[] | undefined, React.Dispatch<React.SetStateAction<Coordinate[] | undefined>>];
};

const CodeEditorContext = createContext<Context>({
  aiAssistant: {
    controllerRef: { current: null },
    loading: [false, () => {}],
    messages: [[], () => {}],
    prompt: ['', () => {}],
  },
  codeString: ['', () => {}],
  consoleOutput: [undefined, () => {}],
  // containerRef: { current: null },
  editorContent: [undefined, () => {}],
  editorRef: { current: null },
  evaluationResult: [undefined, () => {}],
  monacoRef: { current: null },
  panelBottomActiveTab: ['console', () => {}],
  showSnippetsPopover: [false, () => {}],
  spillError: [undefined, () => {}],
});

export const CodeEditorProvider = () => {
  const aiAssistant = {
    prompt: useState<Context['aiAssistant']['prompt'][0]>(''),
    loading: useState<Context['aiAssistant']['loading'][0]>(false),
    messages: useState<Context['aiAssistant']['messages'][0]>([]),
    controllerRef: useRef<Context['aiAssistant']['controllerRef']['current']>(null),
  };
  const codeString = useState<Context['codeString'][0]>(''); // update code cell
  const consoleOutput = useState<Context['consoleOutput'][0]>(undefined);
  // const containerRef = useRef<Context['containerRef']['current']>(null);
  const editorContent = useState<Context['editorContent'][0]>(codeString[0]);
  const editorRef = useRef<Context['editorRef']['current']>(null);
  const evaluationResult = useState<Context['evaluationResult'][0]>(undefined);
  const monacoRef = useRef<Context['monacoRef']['current']>(null);
  const panelBottomActiveTab = useState<PanelTab>('console');
  const showSnippetsPopover = useState<Context['showSnippetsPopover'][0]>(false);
  const spillError = useState<Context['spillError'][0]>(undefined);

  return (
    <CodeEditorContext.Provider
      value={{
        aiAssistant,
        consoleOutput,
        // containerRef,
        codeString,
        editorRef,
        editorContent,
        evaluationResult,
        monacoRef,
        panelBottomActiveTab,
        showSnippetsPopover,
        spillError,
      }}
    >
      <CodeEditor />
    </CodeEditorContext.Provider>
  );
};

export const useCodeEditor = () => useContext(CodeEditorContext);
