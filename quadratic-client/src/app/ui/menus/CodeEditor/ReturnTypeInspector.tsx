import { useTheme } from '@mui/material';
import { Link } from 'react-router-dom';

import { getLanguage } from '@/app/helpers/codeCellLanguage';
import type { CodeCellLanguage } from '@/app/quadratic-core-types';
import { codeEditorBaseStyles } from '@/app/ui/menus/CodeEditor/styles';
import type { EvaluationResult } from '@/app/web-workers/pythonWebWorker/pythonTypes';
import { DOCUMENTATION_JAVASCRIPT_RETURN_DATA, DOCUMENTATION_URL } from '@/shared/constants/urls';

interface ReturnTypeInspectorProps {
  evaluationResult?: EvaluationResult;
  language?: CodeCellLanguage;
  show: boolean;
}

export function ReturnTypeInspector({ evaluationResult, show, language }: ReturnTypeInspectorProps) {
  const theme = useTheme();
  let message: JSX.Element;

  if (getLanguage(language) === 'Python') {
    if (show) {
      message = (
        <>
          Line {evaluationResult?.line_number} returned{' '}
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
    } else {
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
    }
  } else if (getLanguage(language) === 'Javascript') {
    if (show && evaluationResult?.output_type) {
      message = (
        <>
          Returned{' '}
          <span className="rounded-md px-1 py-0.5" style={{ backgroundColor: theme.palette.grey[100] }}>
            {evaluationResult.output_type}
          </span>
          {evaluationResult.line_number !== undefined ? ` on line ${evaluationResult.line_number}` : ''}.
        </>
      );
    } else {
      message = (
        <>
          Use `return` to output value(s) to the sheet.{' '}
          <Link to={DOCUMENTATION_JAVASCRIPT_RETURN_DATA} target="_blank" rel="nofollow" className="underline">
            Learn more.
          </Link>{' '}
        </>
      );
    }
  } else if (getLanguage(language) === 'Connection' && show && evaluationResult?.output_type) {
    const fullMessage = evaluationResult.output_type.split('\n');
    message = (
      <>
        Returned{' '}
        <span className="rounded-md px-1 py-0.5" style={{ backgroundColor: theme.palette.grey[100] }}>
          {fullMessage[0]}
        </span>
        {fullMessage[1]}.
      </>
    );
  } else {
    message = <></>;
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
