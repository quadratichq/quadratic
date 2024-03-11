import { DOCUMENTATION_URL } from '@/constants/urls';
import { EvaluationResult } from '@/web-workers/pythonWebWorker/pythonTypes';
import { KeyboardReturn } from '@mui/icons-material';
import { useTheme } from '@mui/material';
import { Link } from 'react-router-dom';
import { codeEditorBaseStyles } from './styles';

const ReturnType = ({ children }: any) => (
  <span
    style={{
      background: '#eee',
      fontWeight: '600',
      padding: '8px 8px',
    }}
  >
    {children}
  </span>
);

interface ReturnTypeInspectorProps {
  evaluationResult?: EvaluationResult;
}

export function ReturnTypeInspector({ evaluationResult }: ReturnTypeInspectorProps) {
  const theme = useTheme();

  return (
    <>
      <div style={{ flex: '1.5', overflow: 'scroll', fontSize: '.875rem', lineHeight: '1.5' }}>
        <div
          style={{
            outline: 'none',
            whiteSpace: 'pre-wrap',
            ...codeEditorBaseStyles,
          }}
        >
          {evaluationResult?.line_number && (
            <div
              style={{
                color: '#777',
                marginTop: theme.spacing(2.5),
                marginBottom: theme.spacing(2.0),
                marginLeft: theme.spacing(2.0),
                // display: 'flex',
                // alignItems: 'center',
                // gap: theme.spacing(1),
              }}
            >
              <>
                <KeyboardReturn fontSize="small" style={{ transform: 'scaleX(-1)' }} /> Line{' '}
                {evaluationResult?.line_number} returned a <ReturnType>{evaluationResult?.output_type}</ReturnType>
              </>
              {evaluationResult?.output_type === 'NoneType' && (
                <>
                  ,{' '}
                  <Link
                    to={DOCUMENTATION_URL + '/writing-python/return-data-to-the-sheet'}
                    target="_blank"
                    rel="nofollow"
                  >
                    read docs
                  </Link>{' '}
                  to learn more
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
