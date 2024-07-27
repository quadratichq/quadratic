import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { getCodeCell } from '@/app/helpers/codeCellLanguage';
import { useCodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import { codeEditorBaseStyles, codeEditorCommentStyles } from '@/app/ui/menus/CodeEditor/styles';
import useLocalStorage from '@/shared/hooks/useLocalStorage';

export function CodeEditorPlaceholder({
  editorContent,
}: {
  editorContent: string | undefined;
  setEditorContent: (str: string | undefined) => void;
}) {
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const codeCell = getCodeCell(editorInteractionState.mode);
  const [showPlaceholder, setShowPlaceholder] = useLocalStorage<boolean>('showCodeEditorPlaceholder', true);
  const [shouldRunEffect, setShouldRunEffect] = useState<boolean>(false);
  const {
    editorRef,
    showSnippetsPopover: [, setShowSnippetsPopover],
  } = useCodeEditor();

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

  if (codeCell?.id === 'Formula') {
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
      Start typing to dismiss,{' '}
      {(codeCell?.id === 'Python' || codeCell?.id === 'Javascript') && (
        <>
          <button
            className="pointer-events-auto italic underline"
            onClick={() => {
              setShowSnippetsPopover(true);
            }}
          >
            insert a code snippet
          </button>
          , or{' '}
          <button
            className={`pointer-events-auto italic underline`}
            onClick={() => {
              setShowPlaceholder(false);
            }}
          >
            don’t show this again
          </button>
          .
        </>
      )}
      {codeCell?.type === 'connection' && (
        <>
          explore your connection schema below, or{' '}
          <button
            className={`pointer-events-auto italic underline`}
            onClick={() => {
              setShowPlaceholder(false);
            }}
          >
            don’t show this again
          </button>
          .
        </>
      )}
    </div>
  );
}
