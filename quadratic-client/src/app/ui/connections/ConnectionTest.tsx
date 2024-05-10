import { TestConnectionResponse } from '@/shared/api/connectionClient';
import { Type } from '@/shared/components/Type';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { CircularProgress } from '@mui/material';
import { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';

type ConnectionState = 'idle' | 'loading' | 'success' | 'error';
export type ValidateThenTestConnection = () => Promise<() => TestConnectionResponse>;

export function ConnectionTest({
  form,
  validateThenTest,
}: {
  form: UseFormReturn<any>;
  validateThenTest: ValidateThenTestConnection;
}) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [connectionError, setConnectionError] = useState<string>('');
  const [formDataSnapshot, setFormDataSnapshot] = useState<{ [key: string]: any }>({});

  const formData = form.watch();

  // If the user changed some data in the form while it was idle,
  // we'll reset the state of the connection so they know it's not valid anymore
  useEffect(() => {
    if (connectionState === 'idle') return;
    const hasChanges = Object.keys(formData).some((key) => formData[key] !== formDataSnapshot[key]);
    if (hasChanges) {
      setConnectionState('idle');
      setFormDataSnapshot(formData);
    }
  }, [formData, formDataSnapshot, connectionState]);

  return (
    <form
      id="test-connection"
      className={cn(
        'rounded border px-2 py-2',
        connectionState === 'idle' && 'border-border',
        connectionState === 'success' && 'border-success',
        connectionState === 'error' && 'border-destructive'
      )}
      onSubmit={async (e) => {
        e.preventDefault();

        validateThenTest()
          .then(async (test) => {
            setConnectionState('loading');
            const { connected, message } = await test();
            setConnectionError(connected === false && message ? message : '');
            setConnectionState(connected ? 'success' : 'error');
          })
          .catch(() => {
            // form validation failed, don't do anything
          });

        // TODO: (connections) log to sentry if it fails?
      }}
    >
      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary" disabled={connectionState === 'loading'}>
          Test connection
        </Button>
        {connectionState === 'loading' && <CircularProgress style={{ width: 18, height: 18 }} />}
        <div
          className={cn(
            `ml-auto flex items-center gap-1 pr-1 font-medium`,
            (connectionState === 'idle' || connectionState === 'loading') && 'text-muted-foreground',
            connectionState === 'success' && 'text-success',
            connectionState === 'error' && 'text-destructive'
          )}
        >
          {connectionState === 'idle' && <Type>Untested</Type>}
          {connectionState === 'success' && <Type>Ok</Type>}
          {connectionState === 'error' && <Type>Failed</Type>}
        </div>
      </div>
      {connectionState === 'error' && (
        <div className="mt-2 text-right font-mono text-xs text-destructive">{connectionError}</div>
      )}
    </form>
  );
}
