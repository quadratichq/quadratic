import { events } from '@/app/events/events';
import { SpinnerIcon } from '@/shared/components/Icons';
import { memo, useEffect, useState } from 'react';

export const WorkerLoadingIndicator = memo(() => {
  const [loadingPython, setLoadingPython] = useState(false);
  const [loadingJavascript, setLoadingJavascript] = useState(false);

  useEffect(() => {
    const handlePythonLoading = () => {
      setLoadingPython(true);
    };

    const handlePythonInit = () => {
      setLoadingPython(false);
    };

    const handleJavascriptLoading = () => {
      setLoadingJavascript(true);
    };

    const handleJavascriptInit = () => {
      setLoadingJavascript(false);
    };

    events.on('pythonLoading', handlePythonLoading);
    events.on('pythonInit', handlePythonInit);
    events.on('javascriptLoading', handleJavascriptLoading);
    events.on('javascriptInit', handleJavascriptInit);

    return () => {
      events.off('pythonLoading', handlePythonLoading);
      events.off('pythonInit', handlePythonInit);
      events.off('javascriptLoading', handleJavascriptLoading);
      events.off('javascriptInit', handleJavascriptInit);
    };
  }, []);

  if (!loadingPython && !loadingJavascript) {
    return null;
  }

  const languages: string[] = [];
  if (loadingJavascript) {
    languages.push('JavaScript');
  }
  if (loadingPython) {
    languages.push('Python');
  }

  const message = languages.length === 1 ? `Loading ${languages[0]}...` : `Loading ${languages.join(' and ')}...`;

  return (
    <div className="absolute bottom-4 left-4 z-50 select-none rounded border border-border bg-background px-4 py-3 tracking-tight shadow-lg">
      <div className="flex items-center gap-2">
        <SpinnerIcon size="sm" className="text-muted-foreground" />
        <div className="text-sm font-medium">{message}</div>
      </div>
    </div>
  );
});

WorkerLoadingIndicator.displayName = 'WorkerLoadingIndicator';
