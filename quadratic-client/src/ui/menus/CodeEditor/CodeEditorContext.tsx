import { Monaco } from '@monaco-editor/react';
import monaco from 'monaco-editor';
import React, { createContext, useContext, useRef, useState } from 'react';

type Context = {
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>;
  monacoRef: React.MutableRefObject<Monaco | null>;
  showSnippetsPopover: boolean;
  setShowSnippetsPopover: React.Dispatch<React.SetStateAction<boolean>>;
};

const CodeEditorContext = createContext<Context>({
  editorRef: { current: null },
  monacoRef: { current: null },
  showSnippetsPopover: false,
  setShowSnippetsPopover: () => {},
});

export const CodeEditorProvider = ({ children }: { children: React.ReactElement }) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [showSnippetsPopover, setShowSnippetsPopover] = useState<boolean>(false);

  return (
    <CodeEditorContext.Provider
      value={{
        editorRef,
        monacoRef,
        showSnippetsPopover,
        setShowSnippetsPopover,
      }}
    >
      {children}
    </CodeEditorContext.Provider>
  );
};

export const useCodeEditor = () => useContext(CodeEditorContext);
