import monaco from 'monaco-editor';
import { Fragment, RefObject, useEffect, useState } from 'react';
import useLocalStorage from '../../../hooks/useLocalStorage';
import snippets from './snippets';
import { codeEditorBaseStyles, codeEditorCommentStyles } from './styles';

export function CodeEditorPlaceholder({
  editorContent,
  editorRef,
  setEditorContent,
}: {
  editorContent: string | undefined;
  editorRef: RefObject<monaco.editor.IStandaloneCodeEditor | null>;
  setEditorContent: (str: string | undefined) => void;
}) {
  const [showPlaceholder, setShowPlaceholder] = useLocalStorage<boolean>('showCodeEditorPlaceholder', true);
  const [shouldRunEffect, setShouldRunEffect] = useState<boolean>(false);

  // When the user chooses to autofill the editor with a predefined snippet,
  // focus the editor and set the initial cursor position
  useEffect(() => {
    if (editorRef && editorRef.current && shouldRunEffect) {
      editorRef.current.focus();
      editorRef.current.setPosition({ lineNumber: 0, column: 0 });
      setShouldRunEffect(false);
    }
  }, [editorRef, editorContent, shouldRunEffect]);

  if (editorContent) {
    return null;
  }

  if (!showPlaceholder) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: '64px',
        right: '14%',
        top: 0,
        pointerEvents: 'none',
        // Kinda hacky, but we're copying the style of the code editor
        ...codeEditorBaseStyles,
        ...codeEditorCommentStyles,
      }}
    >
      Start typing to dismiss, or insert a code snippet:
      <br />
      <br />
      {snippets.map((snippet, i: number) => (
        <Fragment key={i}>
          •{' '}
          <button
            className={`pointer-events-auto text-inherit underline`}
            onClick={(e) => {
              e.preventDefault();
              setEditorContent(snippet.code);
              setShouldRunEffect(true);
            }}
          >
            {snippet.label}
          </button>
          <br />
        </Fragment>
      ))}
      <br />
      <br />{' '}
      <button
        className={`pointer-events-auto text-inherit underline`}
        onClick={(e) => {
          e.preventDefault();
          setShowPlaceholder(false);
        }}
      >
        Don’t show this again
      </button>
      .
    </div>
  );
}
