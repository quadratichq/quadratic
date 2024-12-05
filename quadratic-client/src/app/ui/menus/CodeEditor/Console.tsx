import {
  codeEditorCodeCellAtom,
  codeEditorConsoleOutputAtom,
  codeEditorSpillErrorAtom,
} from '@/app/atoms/codeEditorAtom';
import { getCodeCell } from '@/app/helpers/codeCellLanguage';
import { colors } from '@/app/theme/colors';
import { codeEditorBaseStyles, codeEditorCommentStyles } from '@/app/ui/menus/CodeEditor/styles';
import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import Linkify from 'react-linkify';

export function Console() {
  const consoleOutput = useRecoilValue(codeEditorConsoleOutputAtom);
  const spillError = useRecoilValue(codeEditorSpillErrorAtom);
  const { language } = useRecoilValue(codeEditorCodeCellAtom);
  const codeCell = useMemo(() => getCodeCell(language), [language]);
  const hasOutput = useMemo(
    () => Boolean(consoleOutput?.stdErr?.length || consoleOutput?.stdOut?.length || spillError),
    [consoleOutput, spillError]
  );

  // Designed to live in a box that takes up the full height of its container
  return (
    <div
      contentEditable={hasOutput}
      suppressContentEditableWarning={true}
      spellCheck={false}
      onKeyDown={(e) => {
        if (((e.metaKey || e.ctrlKey) && e.key === 'a') || ((e.metaKey || e.ctrlKey) && e.key === 'c')) {
          // Allow a few commands, but nothing else
        } else {
          e.preventDefault();
        }
      }}
      className="h-full overflow-y-auto whitespace-pre-wrap pl-3 pr-3 outline-none"
      style={codeEditorBaseStyles}
      // Disable Grammarly
      data-gramm="false"
      data-gramm_editor="false"
      data-enable-grammarly="false"
    >
      {hasOutput ? (
        <>
          {spillError && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.error }}>
              SPILL ERROR: Array output could not expand because it would overwrite existing content. To fix this,
              remove content in cell
              {spillError.length > 1 ? 's' : ''}{' '}
              {spillError.map(
                (pos, index) =>
                  `(${pos.x}, ${pos.y})${
                    index !== spillError.length - 1 ? (index === spillError.length - 2 ? ', and ' : ', ') : '.'
                  }`
              )}
            </span>
          )}
          {consoleOutput?.stdErr && (
            <span style={{ alignItems: 'center', gap: '8px', color: colors.error }}>
              ERROR:{' '}
              <Linkify>
                <div contentEditable="false" suppressContentEditableWarning={true}>
                  {consoleOutput?.stdErr}
                </div>
              </Linkify>
            </span>
          )}
          {consoleOutput?.stdOut}
        </>
      ) : (
        <div className="mt-1 select-none" style={{ ...codeEditorCommentStyles }}>
          {codeCell?.id === 'Python' && <>Print statements, standard out, and errors will show here.</>}
          {codeCell?.id === 'Javascript' && <>Console output and errors will show here.</>}
          {codeCell?.type === 'connection' && <>Errors will show here.</>}
        </div>
      )}
    </div>
  );
}
