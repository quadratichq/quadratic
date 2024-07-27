import { useEffect, useState } from 'react';

import { events } from '@/app/events/events';
import type {
  CoreClientImportProgress,
  CoreClientTransactionProgress,
  CoreClientTransactionStart,
} from '@/app/web-workers/quadraticCore/coreClientMessages';
import { Progress } from '@/shared/shadcn/ui/progress';

// The last message.total + 1 is used to track the execute operation progress.

export const ImportProgress = () => {
  const [filename, setFilename] = useState<string | undefined>(undefined);
  const [percentage, setPercentage] = useState<number | undefined>(undefined);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [show, setShow] = useState(false);

  // Used to track the import operation-creation progress.
  useEffect(() => {
    const handleProgress = (message: CoreClientImportProgress) => {
      setFilename(message.filename);
      const progress = (message.current / (message.total * 2)) * 100;
      setTotal(message.total * 2);
      setPercentage(progress);
      setShow(true);
    };
    events.on('importProgress', handleProgress);
    return () => {
      events.off('importProgress', handleProgress);
    };
  }, []);

  // Used to track the execute operation for the import
  useEffect(() => {
    if (!total) return;
    let transactionId: string | undefined;
    let maxOperations = 0;
    const transactionStart = (message: CoreClientTransactionStart) => {
      if (message.transactionType === 'Import') {
        transactionId = message.transactionId;
      }
    };
    const transactionProgress = (message: CoreClientTransactionProgress) => {
      maxOperations = Math.max(maxOperations, message.remainingOperations);
      if (message.transactionId === transactionId) {
        setPercentage((percentage) => {
          if (!percentage) return percentage;
          const operationPercentage = (1 - message.remainingOperations / maxOperations) * 50;
          const final = 50 + operationPercentage;
          if (final >= 100) {
            // allow the bar to complete before removing it
            setTimeout(() => setShow(false), 250);
          }
          return final;
        });
      }
    };
    events.on('transactionStart', transactionStart);
    events.on('transactionProgress', transactionProgress);
    return () => {
      events.off('transactionStart', transactionStart);
      events.off('transactionProgress', transactionProgress);
    };
  }, [total]);

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
