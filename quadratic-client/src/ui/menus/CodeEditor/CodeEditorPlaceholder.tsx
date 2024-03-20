import { useEffect, useState } from 'react';
import useLocalStorage from '../../../hooks/useLocalStorage';
import { useCodeEditor } from './CodeEditorContext';
import { codeEditorBaseStyles, codeEditorCommentStyles } from './styles';

export function CodeEditorPlaceholder({
  editorContent,
  setEditorContent,
}: {
  editorContent: string | undefined;
  setEditorContent: (str: string | undefined) => void;
}) {
  const [showPlaceholder, setShowPlaceholder] = useLocalStorage<boolean>('showCodeEditorPlaceholder', true);
  const [shouldRunEffect, setShouldRunEffect] = useState<boolean>(false);
  const { editorRef, setShowSnippetsPopover } = useCodeEditor();

  // When the user chooses to autofill the editor with a predefined snippet,
  // focus the editor and set the initial cursor position
  useEffect(() => {
    if (editorRef && editorRef.current && shouldRunEffect) {
      editorRef.current.focus();
      editorRef.current.setPosition({ lineNumber: 0, column: 0 });
      setShouldRunEffect(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorContent, shouldRunEffect]);

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
        // Kinda hacky, but we're copying the style of the code editor
        ...codeEditorBaseStyles,
        ...codeEditorCommentStyles,
      }}
    >
      Start typing to dismiss,{' '}
      <button
        className="cursor-pointer italic underline"
        onClick={() => {
          setShowSnippetsPopover(true);
        }}
      >
        insert a code snippet
      </button>
      , or{' '}
      <button
        className={`pointer-events-auto italic underline`}
        onClick={(e) => {
          e.preventDefault();
          setShowPlaceholder(false);
        }}
      >
        don’t show this again
      </button>
      .
    </div>
  );
}
