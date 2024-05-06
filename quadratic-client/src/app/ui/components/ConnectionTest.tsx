import { connectorClient } from '@/shared/api/connectorClient';
import { Type } from '@/shared/components/Type';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { CircularProgress } from '@mui/material';
import { CheckCircledIcon, ExclamationTriangleIcon, InfoCircledIcon, PlayIcon } from '@radix-ui/react-icons';
import { useEffect, useState } from 'react';

type ConnectionState = 'idle' | 'loading' | 'success' | 'error';

export function ConnectionTest({ type, data }: any) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');

  useEffect(() => {
    // When the data changes, reset the connection state
    setConnectionState('idle');
    console.log('data changed');
  }, [data]);

  return (
    <form
      id="test-connection"
      method="POST"
      onSubmit={async (e) => {
        e.preventDefault();

        setConnectionState('loading');

        // TODO: remove sending extra data
        console.log('Testing connection: ', type, data);

        // @ts-expect-error fix types
        const { connected, message } = await connectorClient.test[type](data);

        if (!connected) {
          console.error(message);
        }

        setConnectionState(connected ? 'success' : 'error');
      }}
      className="grid gap-4"
    >
      <div
        className={cn(
          'flex items-center rounded border px-2 py-2 pl-3',
          connectionState === 'idle' && 'border-border',
          connectionState === 'success' && 'border-success',
          connectionState === 'error' && 'border-destructive'
        )}
      >
        <div className="flex items-center gap-2">
          {connectionState === 'idle' && (
            <>
              <InfoCircledIcon className="text-muted-foreground" />
              <Type>Ensure your connection works</Type>
            </>
          )}
          {connectionState === 'loading' && (
            <>
              <CircularProgress style={{ width: 15, height: 15 }} />
              <Type>Testing…</Type>
            </>
          )}
          {connectionState === 'success' && (
            <>
              <CheckCircledIcon className="text-success" />
              <Type>Connection ok!</Type>
            </>
          )}
          {connectionState === 'error' && (
            <>
              <ExclamationTriangleIcon className="text-destructive" />
              <Type>Connection failed. Adjust details and try again.</Type>
            </>
          )}
        </div>

        <Button type="submit" className="ml-auto" variant="secondary" disabled={false}>
          <PlayIcon className="mr-1" /> Test
        </Button>
      </div>
    </form>
  );
}
