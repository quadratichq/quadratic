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

  const getHeightAndWidth = () => {
    const arrayOutput = selectedCell.evaluation_result?.array_output;
    if (!arrayOutput) return null;
    const rowsLength = arrayOutput.length;
    const rows = `${rowsLength} ${rowsLength === 1 ? 'row' : 'rows'}`;
    if (!arrayOutput[0] || !arrayOutput[0].length || arrayOutput[0].length === 1) return rows;

    return `${rows} x ${arrayOutput[0].length} columns`;
  };

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
        flexWrap: 'wrap',
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
          <span>{getHeightAndWidth()}</span>
        </>
      )}
    </div>
  );
};

export default PythonReturnType;
