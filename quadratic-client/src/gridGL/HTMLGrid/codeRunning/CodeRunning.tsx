import { sheets } from '@/grid/controller/Sheets';
import { multiplayer } from '@/multiplayer/multiplayer';
import { pythonWebWorker } from '@/web-workers/pythonWebWorker/python';
import { CircularProgress } from '@mui/material';
import { useEffect, useState } from 'react';
import './CodeRunning.css';

interface Code {
  left: string;
  top: string;
  color: string;
}

const CIRCULAR_PROGRESS_SIZE = 14;

export const CodeRunning = () => {
  const [code, setCode] = useState<Code[]>([]);

  useEffect(() => {
    const updateCode = () => {
      const cells = pythonWebWorker.getRunningCells(sheets.sheet.id);
      const sheet = sheets.sheet;
      const code = cells.map((cell) => {
        const rectangle = sheet.getCellOffsets(cell.x, cell.y);
        return {
          left: `${rectangle.x + rectangle.width / 2 - CIRCULAR_PROGRESS_SIZE / 2}px`,
          top: `${rectangle.y + rectangle.height / 2 - CIRCULAR_PROGRESS_SIZE / 2}px`,
          color: 'black',
        };
      });
      multiplayer.getUsers().forEach((user) => {
        user.parsedCodeRunning.forEach((cell) => {
          if (cell.sheetId === sheet.id) {
            const rectangle = sheet.getCellOffsets(cell.x, cell.y);
            code.push({
              left: `${rectangle.x + rectangle.width / 2 - CIRCULAR_PROGRESS_SIZE / 2}px`,
              top: `${rectangle.y + rectangle.height / 2 - CIRCULAR_PROGRESS_SIZE / 2}px`,
              color: user.colorString,
            });
          }
        });
      });
      setCode(code);
    };

    window.addEventListener('python-change', updateCode);
    window.addEventListener('change-sheet', updateCode);
    updateCode();
    return () => {
      window.addEventListener('python-change', updateCode);
      window.removeEventListener('change-sheet', updateCode);
    };
  }, []);

  return (
    <div className="code-running-container">
      {code.map((code, index) => (
        <CircularProgress
          color={code.color === 'black' ? 'primary' : undefined}
          size={`${CIRCULAR_PROGRESS_SIZE}px`}
          key={index}
          sx={{ position: 'absolute', left: code.left, top: code, color: code.color }}
        />
      ))}
    </div>
  );
};
