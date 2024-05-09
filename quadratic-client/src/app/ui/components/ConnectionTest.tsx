import { connectorClient } from '@/shared/api/connectorClient';
import { Type } from '@/shared/components/Type';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { CircularProgress } from '@mui/material';
import { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';

type ConnectionState = 'idle' | 'loading' | 'success' | 'error';

export function ConnectionTest({ form }: { form: UseFormReturn<any> }) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    setConnectionState('idle');
  }, [form.formState.isDirty]);

  return (
    <form
      id="test-connection"
      className="grid gap-4"
      onSubmit={form.handleSubmit((values: any, e: any) => {
        e.preventDefault();

        // Get the form type
        const type: string = values.type.toLowerCase();

        // TODO: (connections) remove sending extra data
        console.log('Testing connection: ', type, values);
        setConnectionState('loading');

        // @ts-ignore
        connectorClient.test[type](values).then(({ connected, message }) => {
          if (!connected) {
            console.error(message);
          }
          setErrorMsg(connected ? '' : message);
          setConnectionState(connected ? 'success' : 'error');
        });

        // TODO: (connections) log to sentry
      })}
    >
      <div
        className={cn(
          'rounded border px-2 py-2',
          connectionState === 'idle' && 'border-border',
          connectionState === 'success' && 'border-success',
          connectionState === 'error' && 'border-destructive'
        )}
      >
        <div className="flex items-center">
          <Button type="submit" className="mr-auto" variant="secondary" disabled={false}>
            Test connection
          </Button>
          <div
            className={cn(
              `flex items-center gap-1 pr-1 font-medium`,
              (connectionState === 'idle' || connectionState === 'loading') && 'text-muted-foreground',
              connectionState === 'success' && 'text-success',
              connectionState === 'error' && 'text-destructive'
            )}
          >
            {connectionState === 'idle' && <Type>Untested</Type>}
            {connectionState === 'loading' && <CircularProgress style={{ width: 15, height: 15 }} />}
            {connectionState === 'success' && <Type>Ok</Type>}
            {connectionState === 'error' && <Type>Failed</Type>}
          </div>
        </div>
        {connectionState === 'error' && (
          <div className="mt-2 text-right font-mono text-xs text-destructive">{errorMsg}</div>
        )}
      </div>
    </form>
  );
}
