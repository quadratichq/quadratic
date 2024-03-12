import { DOCUMENTATION_URL } from '@/constants/urls';
import { EvaluationResult } from '@/web-workers/pythonWebWorker/pythonTypes';
import { useTheme } from '@mui/material';
import { Link } from 'react-router-dom';
import { codeEditorBaseStyles } from './styles';

interface ReturnTypeInspectorProps {
  evaluationResult?: EvaluationResult;
}

export function ReturnTypeInspector({ evaluationResult }: ReturnTypeInspectorProps) {
  const theme = useTheme();

  return (
    <div
      className="flex gap-6 whitespace-pre-wrap px-6 py-2 outline-none"
      style={{
        color: theme.palette.text.secondary,
        ...codeEditorBaseStyles,
      }}
    >
      <span style={{ transform: 'scaleX(-1)', display: 'inline-block', fontSize: '10px' }}>⮐</span>
      <span className="leading-snug">
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
      </span>
    </div>
  );
}
