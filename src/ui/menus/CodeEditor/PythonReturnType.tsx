import { KeyboardReturn } from '@mui/icons-material';
import { useTheme } from '@mui/system';
import { Cell } from '../../../schemas';
import { InspectPythonReturnType } from '../../../web-workers/pythonWebWorker/pythonTypes';

type PythonReturnTypeProps = {
  selectedCell: Cell;
  pythonReturnType: InspectPythonReturnType | undefined;
  std_err: string;
  hasUnsavedChanges: boolean;
  isRunningComputation: boolean;
};

const PythonReturnType = ({
  selectedCell,
  std_err,
  hasUnsavedChanges,
  pythonReturnType,
  isRunningComputation,
}: PythonReturnTypeProps) => {
  const theme = useTheme();
  const outputType = selectedCell.evaluation_result?.output_type;

  if (!pythonReturnType || 'error' in pythonReturnType) return null;

  return (
    <div
      style={{
        // padding: '4px 0 8px',
        // color: hasUnsavedChanges ? '#777' : 'green',
        color: std_err ? 'red' : '#777',
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1),
      }}
    >
      <KeyboardReturn fontSize="small" style={{ transform: 'scaleX(-1)' }} />{' '}
      <span
        style={{
          background: '#eee',
          fontWeight: '600',
          padding: '1px 8px',
        }}
      >
        {std_err ? 'ERROR' : hasUnsavedChanges || isRunningComputation ? '…' : outputType}
      </span>
      {std_err ? (
        ''
      ) : hasUnsavedChanges || isRunningComputation ? (
        <>
          [
          <a href="#TODO" style={{ color: 'inherit' }}>
            line: {pythonReturnType?.lineno}
          </a>
          ]
        </>
      ) : (
        <>
          [
          <a href="#TODO" style={{ color: 'inherit' }}>
            line: {pythonReturnType?.lineno}
          </a>
          ] {pythonReturnType?.value_type}
        </>
      )}
    </div>
  );
};

export default PythonReturnType;
