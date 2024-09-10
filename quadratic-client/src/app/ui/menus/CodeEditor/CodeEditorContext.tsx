import { Coordinate } from '@/app/gridGL/types/size';
import { CodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditor';
import { EvaluationResult } from '@/app/web-workers/pythonWebWorker/pythonTypes';
import { Monaco } from '@monaco-editor/react';
import monaco from 'monaco-editor';
import { AIMessage, AnthropicModel, OpenAIModel, UserMessage } from 'quadratic-shared/typesAndSchemasAI';
import React, { createContext, useContext, useRef, useState } from 'react';
import { PanelTab } from './panels//CodeEditorPanelBottom';

type Context = {
  aiAssistant: {
    controllerRef: React.MutableRefObject<AbortController | null>;
    loading: [boolean, React.Dispatch<React.SetStateAction<boolean>>];
    messages: [(UserMessage | AIMessage)[], React.Dispatch<React.SetStateAction<(UserMessage | AIMessage)[]>>];
    prompt: [string, React.Dispatch<React.SetStateAction<string>>];
    model: [AnthropicModel | OpenAIModel, React.Dispatch<React.SetStateAction<AnthropicModel | OpenAIModel>>];
  };
  // `undefined` is used here as a loading state. Once the editor mounts, it becomes a string (possibly empty)
  codeString: [string | undefined, React.Dispatch<React.SetStateAction<string | undefined>>];
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
    model: ['claude-3-5-sonnet-20240620', () => {}],
  },
  codeString: [undefined, () => {}],
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
    model: useState<Context['aiAssistant']['model'][0]>('claude-3-5-sonnet-20240620'),
  };
  const codeString = useState<Context['codeString'][0]>(undefined); // update code cell
  const consoleOutput = useState<Context['consoleOutput'][0]>(undefined);
  // const containerRef = useRef<Context['containerRef']['current']>(null);
  const editorContent = useState<Context['editorContent'][0]>(codeString[0]);
  const editorRef = useRef<Context['editorRef']['current']>(null);
  const evaluationResult = useState<Context['evaluationResult'][0]>(undefined);
  const monacoRef = useRef<Context['monacoRef']['current']>(null);
  const panelBottomActiveTab = useState<PanelTab>('ai-assistant');
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
