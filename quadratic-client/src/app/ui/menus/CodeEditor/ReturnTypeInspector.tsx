import {
  aiAssistantLoadingAtom,
  aiAssistantWaitingOnMessageIndexAtom,
  codeEditorCodeCellAtom,
  codeEditorConsoleOutputAtom,
  codeEditorEditorContentAtom,
  codeEditorEvaluationResultAtom,
  codeEditorLoadingAtom,
  codeEditorSpillErrorAtom,
  codeEditorUnsavedChangesAtom,
} from '@/app/atoms/codeEditorAtom';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { FixSpillError } from '@/app/ui/components/FixSpillError';
import { useSubmitAIAssistantPrompt } from '@/app/ui/menus/CodeEditor/hooks/useSubmitAIAssistantPrompt';
import { codeEditorBaseStyles } from '@/app/ui/menus/CodeEditor/styles';
import { DOCUMENTATION_JAVASCRIPT_RETURN_DATA, DOCUMENTATION_URL } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { timeAgoAndNextTimeout } from '@/shared/utils/timeAgo';
import { createTextContent } from 'quadratic-shared/ai/helpers/message.helper';
import type { JSX, ReactNode } from 'react';
import { memo, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useRecoilValue } from 'recoil';

export const ReturnTypeInspector = memo(() => {
  const loading = useRecoilValue(codeEditorLoadingAtom);
  const { language } = useRecoilValue(codeEditorCodeCellAtom);
  const mode = useMemo(() => getLanguage(language), [language]);
  const spillError = useRecoilValue(codeEditorSpillErrorAtom);
  const editorContent = useRecoilValue(codeEditorEditorContentAtom);
  const codeCell = useRecoilValue(codeEditorCodeCellAtom);
  const evaluationResult = useRecoilValue(codeEditorEvaluationResultAtom);
  const unsavedChanges = useRecoilValue(codeEditorUnsavedChangesAtom);
  const consoleOutput = useRecoilValue(codeEditorConsoleOutputAtom);
  const codeCellRecoil = useRecoilValue(codeEditorCodeCellAtom);
  const aiAssistantLoading = useRecoilValue(aiAssistantLoadingAtom);
  const aiAssistantWaitingOnMessageIndex = useRecoilValue(aiAssistantWaitingOnMessageIndexAtom);

  const { submitPrompt } = useSubmitAIAssistantPrompt();

  const show = evaluationResult?.line_number && evaluationResult?.output_type && !unsavedChanges;

  let message: JSX.Element | undefined = undefined;
  let action: JSX.Element | undefined = undefined;
  let hasError = false;

  if (consoleOutput?.stdErr) {
    hasError = true;
    message = (
      <span>
        Returned <ReturnType isError>error</ReturnType>{' '}
      </span>
    );
    action = (
      <Button
        size="sm"
        variant="destructive"
        className="ml-auto"
        onClick={() => {
          trackEvent('[AIAssistant].fixWithAI', {
            language: codeCellRecoil.language,
          });
          submitPrompt({
            messageSource: 'FixWithAI',
            content: [createTextContent('Fix the error in the code cell')],
            messageIndex: 0,
            codeCell: codeCellRecoil,
          }).catch(console.error);
        }}
        disabled={aiAssistantLoading || aiAssistantWaitingOnMessageIndex !== undefined}
      >
        Fix in AI chat
      </Button>
    );
  } else if (spillError) {
    hasError = true;
    message = (
      <span>
        Returned <ReturnType isError>error</ReturnType> (spill)
      </span>
    );
    action = <FixSpillError codeCell={codeCellRecoil} evaluationResult={evaluationResult ?? {}} />;
  } else if (mode === 'Python') {
    message = show ? (
      <>
        {evaluationResult.line_number ? `Line ${evaluationResult.line_number} returned ` : 'Returned '}

        <ReturnType>{evaluationResult?.output_type}</ReturnType>

        {evaluationResult?.output_type === 'NoneType' && (
          <>
            {' '}
            <Link
              to={DOCUMENTATION_URL + '/writing-python/return-data-to-the-sheet'}
              target="_blank"
              rel="nofollow"
              className="underline"
            >
              (docs)
            </Link>
          </>
        )}
      </>
    ) : (
      <>
        Last line returns to the sheet{' '}
        <Link
          to={DOCUMENTATION_URL + '/writing-python/return-data-to-the-sheet'}
          target="_blank"
          rel="nofollow"
          className="underline"
        >
          (docs)
        </Link>
      </>
    );
  } else if (mode === 'Javascript') {
    message = show ? (
      <>
        {evaluationResult.line_number ? `Line ${evaluationResult.line_number} returned ` : 'Returned '}
        <ReturnType>{evaluationResult.output_type}</ReturnType>
      </>
    ) : (
      <>
        Use `return` to send data to the sheet{' '}
        <Link to={DOCUMENTATION_JAVASCRIPT_RETURN_DATA} target="_blank" rel="nofollow" className="underline">
          (docs)
        </Link>
      </>
    );
  } else if (mode === 'Connection' && show && evaluationResult?.output_type) {
    const fullMessage = evaluationResult.output_type.split('\n');
    message = (
      <>
        Returned <ReturnType>{fullMessage[0]}</ReturnType>
        {fullMessage[1]}
      </>
    );
  }

  const [lastModified, setLastModified] = useState('');
  useEffect(() => {
    let timeout: number | undefined;
    if (codeCell.lastModified) {
      const update = () => {
        const { timeAgo, nextInterval } = timeAgoAndNextTimeout(codeCell.lastModified, true);
        // add `on` for dates
        // fixed date, does not need to be updated
        if (!timeAgo.includes('ago')) {
          setLastModified(`on ${timeAgo}`);
        }
        // relative time, needs to be updated
        else {
          setLastModified(timeAgo);
        }

        if (nextInterval > 0) {
          timeout = window.setTimeout(update, nextInterval);
        }
      };

      update();
    }
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [codeCell]);

  if (message === undefined || language === 'Formula' || !editorContent || loading) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex h-10 items-center gap-6 whitespace-pre-wrap px-6 text-muted-foreground outline-none',
        hasError && 'text-destructive'
      )}
      style={{
        ...codeEditorBaseStyles,
      }}
    >
      <span style={{ transform: 'scaleX(-1)', display: 'inline-block', fontSize: '10px' }}>⮐</span>

      <span className="leading-tight">
        {message}
        {lastModified && <span> {lastModified}</span>}
      </span>

      {action && <span className="ml-auto flex-shrink-0 font-sans">{action}</span>}
    </div>
  );
});

const ReturnType = memo(({ children, isError }: { children: ReactNode; isError?: boolean }) => {
  return (
    <span className={cn('rounded-md px-1 py-0.5', isError ? 'bg-destructive-foreground' : 'bg-accent')}>
      {children}
    </span>
  );
});
