import {
  codeEditorEditorContentAtom,
  codeEditorEvaluationResultAtom,
  codeEditorLanguageAtom,
  codeEditorLoadingAtom,
  codeEditorUnsavedChangesAtom,
} from '@/app/atoms/codeEditorAtom';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { DOCUMENTATION_JAVASCRIPT_RETURN_DATA, DOCUMENTATION_URL } from '@/shared/constants/urls';
import { useTheme } from '@mui/material';
import { ReactNode, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { codeEditorBaseStyles } from './styles';

export function ReturnTypeInspector() {
  const theme = useTheme();
  const loading = useRecoilValue(codeEditorLoadingAtom);
  const language = useRecoilValue(codeEditorLanguageAtom);
  const mode = useMemo(() => getLanguage(language), [language]);

  const editorContent = useRecoilValue(codeEditorEditorContentAtom);

  const evaluationResult = useRecoilValue(codeEditorEvaluationResultAtom);
  const unsavedChanges = useRecoilValue(codeEditorUnsavedChangesAtom);

  const show = evaluationResult?.line_number && evaluationResult?.output_type && !unsavedChanges;

  let message: JSX.Element | undefined = undefined;

  if (mode === 'Python') {
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
      className="flex gap-6 whitespace-pre-wrap px-6 py-2 outline-none"
      style={{
        color: theme.palette.text.secondary,
        ...codeEditorBaseStyles,
      }}
    >
      <span style={{ transform: 'scaleX(-1)', display: 'inline-block', fontSize: '10px' }}>⮐</span>
      <span className="leading-snug">{message}</span>
    </div>
  );
}

function ReturnType({ children }: { children: ReactNode }) {
  return <span className="rounded-md bg-accent px-1 py-0.5">{children}</span>;
}
