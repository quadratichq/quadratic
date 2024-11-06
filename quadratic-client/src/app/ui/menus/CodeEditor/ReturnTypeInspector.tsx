import {
  codeEditorCodeCellAtom,
  codeEditorConsoleOutputAtom,
  codeEditorEditorContentAtom,
  codeEditorEvaluationResultAtom,
  codeEditorLoadingAtom,
  codeEditorSpillErrorAtom,
  codeEditorUnsavedChangesAtom,
} from '@/app/atoms/codeEditorAtom';
import { events } from '@/app/events/events';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { FixSpillError } from '@/app/ui/components/FixSpillError';
import { DOCUMENTATION_JAVASCRIPT_RETURN_DATA, DOCUMENTATION_URL } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { useTheme } from '@mui/material';
import { ReactNode, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { codeEditorBaseStyles } from './styles';

export function ReturnTypeInspector() {
  const theme = useTheme();
  const loading = useRecoilValue(codeEditorLoadingAtom);
  const { language } = useRecoilValue(codeEditorCodeCellAtom);
  const mode = useMemo(() => getLanguage(language), [language]);
  const spillError = useRecoilValue(codeEditorSpillErrorAtom);
  const editorContent = useRecoilValue(codeEditorEditorContentAtom);
  const evaluationResult = useRecoilValue(codeEditorEvaluationResultAtom);
  const unsavedChanges = useRecoilValue(codeEditorUnsavedChangesAtom);
  const consoleOutput = useRecoilValue(codeEditorConsoleOutputAtom);
  const codeCellRecoil = useRecoilValue(codeEditorCodeCellAtom);

  const show = evaluationResult?.line_number && evaluationResult?.output_type && !unsavedChanges;

  let message: JSX.Element | undefined = undefined;
  let action: JSX.Element | undefined = undefined;
  let hasError = false;

  if (consoleOutput?.stdErr) {
    hasError = true;
    message = (
      <p>
        Returned <ReturnType isError>error</ReturnType>{' '}
      </p>
    );
    action = (
      <Button
        size="sm"
        variant="destructive"
        className="ml-auto"
        onClick={() => events.emit('askAICodeCell', codeCellRecoil)}
      >
        Fix in AI chat
      </Button>
    );
  } else if (spillError) {
    hasError = true;
    message = (
      <p>
        Returned <ReturnType isError>error</ReturnType> (spill)
      </p>
    );
    action = <FixSpillError />;
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
        Returned{' '}
        <span className="rounded-md px-1 py-0.5" style={{ backgroundColor: theme.palette.grey[100] }}>
          {fullMessage[0]}
        </span>
        {fullMessage[1]}
      </>
    );
  }

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
      <span className="leading-snug">{message}</span>
      {action && <span className="ml-auto font-sans">{action}</span>}
    </div>
  );
}

function ReturnType({ children, isError }: { children: ReactNode; isError?: boolean }) {
  return (
    <span className={cn('rounded-md px-1 py-0.5', isError ? 'bg-destructive-foreground' : 'bg-accent')}>
      {children}
    </span>
  );
}
