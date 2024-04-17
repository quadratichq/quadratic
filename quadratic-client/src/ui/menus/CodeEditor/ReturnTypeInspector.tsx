import { DOCUMENTATION_URL } from '@/constants/urls';
import { CodeCellLanguage } from '@/quadratic-core-types';
import { EvaluationResult } from '@/web-workers/pythonWebWorker/pythonTypes';
import { useTheme } from '@mui/material';
import { Link } from 'react-router-dom';
import { codeEditorBaseStyles } from './styles';

interface ReturnTypeInspectorProps {
  evaluationResult?: EvaluationResult;
  language?: CodeCellLanguage;
  show: boolean;
}

export function ReturnTypeInspector({ evaluationResult, show, language }: ReturnTypeInspectorProps) {
  const theme = useTheme();
  let message: JSX.Element;
  if (language === 'Python') {
    message = (
      <>
        The last line is returned to the sheet.{' '}
        <Link
          to={DOCUMENTATION_URL + '/writing-python/return-data-to-the-sheet'}
          target="_blank"
          rel="nofollow"
          className="underline"
        >
          Learn more.
        </Link>{' '}
      </>
    );
  } else if (language === 'Javascript') {
    if (evaluationResult?.output_type) {
      message = (
        <>
          Returned{' '}
          <span className="rounded-md px-1 py-0.5" style={{ backgroundColor: theme.palette.grey[100] }}>
            {evaluationResult.output_type}
          </span>{' '}
          on line {evaluationResult.line_number}
        </>
      );
    } else {
      message = <>Use `return` to output value(s) to the sheet.</>;
    }
  } else {
    message = <></>;
  }

  if (show && language === 'Python')
    message = (
      <>
        Line {evaluationResult?.line_number} returned a{' '}
        <span className="rounded-md px-1 py-0.5" style={{ backgroundColor: theme.palette.grey[100] }}>
          {evaluationResult?.output_type}
        </span>
        {evaluationResult?.output_type === 'NoneType' && (
          <>
            {' '}
            <Link
              to={DOCUMENTATION_URL + '/writing-python/return-data-to-the-sheet'}
              target="_blank"
              rel="nofollow"
              className="underline"
            >
              read the docs
            </Link>{' '}
            to learn more
          </>
        )}
      </>
    );

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
