import { events } from '@/events/events';
import { Progress } from '@/shadcn/ui/progress';
import { CoreClientImportProgress } from '@/web-workers/quadraticCore/coreClientMessages';
import { useEffect, useState } from 'react';

// hack to ensure there is time for rendering the text before the progress bar goes away
const TIMEOUT_FOR_RENDERING = 1000;

export const ImportProgress = () => {
  const [filename, setFilename] = useState<string | undefined>(undefined);
  const [percentage, setPercentage] = useState<number | undefined>(undefined);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleProgress = (message: CoreClientImportProgress) => {
      setFilename(message.filename);
      const progress = Math.round((message.current / message.total) * 100);
      setPercentage(progress);
      if (progress === 100) {
        // wait a frame so the bar appears full
        setTimeout(() => setShow(false), TIMEOUT_FOR_RENDERING);
      } else {
        setShow(true);
      }
    };

    events.on('importProgress', handleProgress);
    return () => {
      events.off('importProgress', handleProgress);
    };
  }, []);

  useEffect(() => {}, []);

  if (!show) return;

  return (
    <div
      style={{
        position: 'absolute',
        left: '2rem',
        bottom: '1rem',
        zIndex: 2,
        background: 'white',
        border: '1px solid black',
        padding: '1rem',
        minWidth: '300px',
        pointerEvents: 'none',
      }}
    >
      <div style={{ marginBottom: '1rem' }}>Importing {filename}...</div>
      <Progress value={percentage} />
    </div>
  );
};
