import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { getCodeCell } from '@/app/helpers/codeCellLanguage';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import mixpanel from 'mixpanel-browser';
import { useRecoilValue } from 'recoil';
import { useCodeEditor } from './CodeEditorContext';
import { codeEditorBaseStyles, codeEditorCommentStyles } from './styles';

export function CodeEditorPlaceholder() {
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const codeCell = getCodeCell(editorInteractionState.mode);
  const [showPlaceholder, setShowPlaceholder] = useLocalStorage<boolean>('showCodeEditorPlaceholder', true);
  const {
    editorContent: [editorContent],
  } = useCodeEditor();

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
      {(codeCell?.id === 'Python' || codeCell?.id === 'Javascript') && <>insert a code snippet below,</>}
      {codeCell?.type === 'connection' && <>explore your connection schema below,</>}
      {' or '}
      <button
        className={`pointer-events-auto italic underline`}
        onClick={() => {
          setShowPlaceholder(false);
          mixpanel.track('[CodeEditorPlaceholder].dismissed');
        }}
      >
        don’t show this again
      </button>
      .
    </div>
  );
}