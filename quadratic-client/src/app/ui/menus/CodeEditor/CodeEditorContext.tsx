import { Coordinate } from '@/app/gridGL/types/size';
import { AiMessage } from '@/app/ui/menus/CodeEditor/AiAssistant';
import { CodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditor';
import { PanelTab } from '@/app/ui/menus/CodeEditor/CodeEditorPanelBottom';
import { EvaluationResult } from '@/app/web-workers/pythonWebWorker/pythonTypes';
import { Monaco } from '@monaco-editor/react';
import monaco from 'monaco-editor';
import React, { createContext, useContext, useRef, useState } from 'react';

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
  containerRef: React.RefObject<HTMLDivElement>;
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
  containerRef: { current: null },
  editorContent: [undefined, () => {}],
  evaluationResult: [undefined, () => {}],
  editorRef: { current: null },
  monacoRef: { current: null },
  panelBottomActiveTab: ['console', () => {}],
  showSnippetsPopover: [false, () => {}],
  spillError: [undefined, () => {}],
});

export const CodeEditorProvider = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelBottomActiveTab = useState<PanelTab>('console');
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const showSnippetsPopover = useState<Context['showSnippetsPopover'][0]>(false);
  const codeString = useState<Context['codeString'][0]>(''); // update code cell
  const editorContent = useState<Context['editorContent'][0]>(codeString[0]);
  const evaluationResult = useState<Context['evaluationResult'][0]>(undefined);
  const consoleOutput = useState<Context['consoleOutput'][0]>(undefined);
  const spillError = useState<Context['spillError'][0]>(undefined);

  // State for the AI assistant lives here because we render the component in
  // different places, like the bottom/side panels, and so we need to share
  // the state between these different places for rendering.
  const aiAssistant = {
    prompt: useState<string>(''),
    loading: useState<boolean>(false),
    messages: useState<AiMessage[]>([]),
    controllerRef: useRef<AbortController>(null),
  };

  return (
    <CodeEditorContext.Provider
      value={{
        aiAssistant,
        consoleOutput,
        containerRef,
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
