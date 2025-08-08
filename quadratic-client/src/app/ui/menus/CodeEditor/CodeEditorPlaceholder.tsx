import { codeEditorCodeCellAtom, codeEditorEditorContentAtom } from '@/app/atoms/codeEditorAtom';
import { getCodeCell } from '@/app/helpers/codeCellLanguage';
import { codeEditorBaseStyles, codeEditorCommentStyles } from '@/app/ui/menus/CodeEditor/styles';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';

export function CodeEditorPlaceholder() {
  const { language } = useRecoilValue(codeEditorCodeCellAtom);
  const codeCell = useMemo(() => getCodeCell(language), [language]);
  const [showPlaceholder, setShowPlaceholder] = useLocalStorage<boolean>('showCodeEditorPlaceholder', true);
  const editorContent = useRecoilValue(codeEditorEditorContentAtom);

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
          trackEvent('[CodeEditorPlaceholder].dismissed');
        }}
      >
        don’t show this again
      </button>
      .
    </div>
  );
}
