import { events } from '@/events/events';
import { sheets } from '@/grid/controller/Sheets';
import { multiplayer } from '@/web-workers/multiplayerWebWorker/multiplayer';
import { pythonWebWorker } from '@/web-workers/pythonWebWorker/pythonWebWorker';
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
      if (code?.length === 0) return;
      const cells = pythonWebWorker.getRunningCells(sheets.sheet.id);
      const sheet = sheets.sheet;
      const codeCells = cells.map((cell) => {
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
            codeCells.push({
              left: `${rectangle.x + rectangle.width / 2 - CIRCULAR_PROGRESS_SIZE / 2}px`,
              top: `${rectangle.y + rectangle.height / 2 - CIRCULAR_PROGRESS_SIZE / 2}px`,
              color: user.colorString,
            });
          }
        });
      });
      setCode(codeCells);
    };

    window.addEventListener('python-change', updateCode);
    events.on('changeSheet', updateCode);
    updateCode();
    return () => {
      window.addEventListener('python-change', updateCode);
      events.off('changeSheet', updateCode);
    };
  }, [code?.length]);

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
