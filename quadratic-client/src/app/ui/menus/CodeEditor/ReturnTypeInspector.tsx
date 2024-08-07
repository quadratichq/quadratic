import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { CodeCellLanguage } from '@/app/quadratic-core-types';
import { EvaluationResult } from '@/app/web-workers/pythonWebWorker/pythonTypes';
import { DOCUMENTATION_JAVASCRIPT_RETURN_DATA, DOCUMENTATION_URL } from '@/shared/constants/urls';
import { useTheme } from '@mui/material';
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { codeEditorBaseStyles } from './styles';

interface ReturnTypeInspectorProps {
  evaluationResult: EvaluationResult | undefined;
  language: CodeCellLanguage | undefined;
  unsaved: boolean;
}

export function ReturnTypeInspector({ evaluationResult, unsaved, language }: ReturnTypeInspectorProps) {
  const theme = useTheme();
  const show = evaluationResult?.line_number && evaluationResult?.output_type && !unsaved;

  let message: JSX.Element | undefined = undefined;

  if (getLanguage(language) === 'Python') {
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
  } else if (getLanguage(language) === 'Javascript') {
    message = show ? (
      <>
        {evaluationResult.line_number ? `Line ${evaluationResult.line_number} returned ` : 'Returned '}
        <ReturnType>{evaluationResult.output_type}</ReturnType>
      </>
    ) : (
      <>
        Use `return` to return data to the sheet{' '}
        <Link to={DOCUMENTATION_JAVASCRIPT_RETURN_DATA} target="_blank" rel="nofollow" className="underline">
          (docs)
        </Link>
      </>
    );
  } else if (getLanguage(language) === 'Connection' && show && evaluationResult?.output_type) {
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

  if (message === undefined) {
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
