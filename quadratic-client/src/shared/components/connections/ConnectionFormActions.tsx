import { getDeleteConnectionAction } from '@/routes/api.connections';
import { connectionClient } from '@/shared/api/connectionClient';
import { ConnectionFormValues } from '@/shared/components/connections/connectionsByType';
import { SpinnerIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { CheckCircledIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useSubmit } from 'react-router-dom';

type ConnectionState = 'idle' | 'loading' | 'success' | 'error';

export function ConnectionFormActions({
  connectionType,
  connectionUuid,
  form,
  handleNavigateToListView,
}: {
  connectionType: ConnectionType;
  connectionUuid: string | undefined;
  form: UseFormReturn<any>;
  handleNavigateToListView: () => void;
}) {
  const submit = useSubmit();
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [connectionError, setConnectionError] = useState<string>('');
  const [formDataSnapshot, setFormDataSnapshot] = useState<{ [key: string]: any }>({});

  const formData = form.watch();

  // If the user changed some data, reset the state of the connection so they
  // know it's not valid anymore
  useEffect(() => {
    const hasChanges = Object.keys(formData).some((key) => formData[key] !== formDataSnapshot[key]);
    if (hasChanges) {
      setConnectionState('idle');
      setFormDataSnapshot(formData);
    }
  }, [formData, formDataSnapshot]);

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex flex-col gap-1">
        <div className="flex w-full justify-end gap-2">
          <div className="mr-auto flex items-center gap-2">
            <Button
              type="button"
              className="w-32"
              variant={connectionState === 'success' ? 'success' : 'secondary'}
              disabled={connectionState === 'loading'}
              onClick={form.handleSubmit(async (values: ConnectionFormValues) => {
                const { name, type, ...typeDetails } = values;
                mixpanel.track('[Connections].test', { type });
                setConnectionState('loading');

                try {
                  const { connected, message } = await connectionClient.test.run({
                    type,
                    typeDetails,
                  });
                  setConnectionError(connected === false && message ? message : '');
                  setConnectionState(connected ? 'success' : 'error');
                } catch (e) {
                  setConnectionError('Network error: failed to make connection.');
                  setConnectionState('error');
                }
              })}
            >
              {connectionState === 'success' ? (
                <>
                  <CheckCircledIcon className="mr-1" /> Connected
                </>
              ) : connectionState === 'loading' ? (
                <SpinnerIcon className="text-primary" />
              ) : (
                'Test'
              )}
            </Button>
            {connectionState === 'error' && (
              <div className={`ml-auto flex items-center gap-1 pr-1 font-medium text-destructive`}>
                <ExclamationTriangleIcon />
              </div>
            )}
          </div>

          <Button variant="outline" onClick={handleNavigateToListView} type="button">
            Cancel
          </Button>
          <Button type="submit">{connectionUuid ? 'Save changes' : 'Create'}</Button>
        </div>
        {connectionState === 'error' && (
          <div className="mt-2 font-mono text-xs text-destructive">{connectionError}</div>
        )}
      </div>

      {connectionUuid && (
        <div className="mt-2 flex items-center justify-between gap-6 rounded border border-border p-4 text-sm">
          <div className="">
            <strong className="font-semibold">Delete connection:</strong>{' '}
            <span className="text-muted-foreground">
              this connection will be disabled in existing sheets and no longer usable elsewhere.{' '}
            </span>
          </div>
          <Button
            type="button"
            variant="outline-destructive"
            className="flex-shrink-0"
            onClick={() => {
              const doDelete = window.confirm('Please confirm you want delete this connection. This cannot be undone.');
              if (doDelete) {
                mixpanel.track('[Connections].delete', { type: connectionType });
                const data = getDeleteConnectionAction(connectionUuid);
                submit(data, {
                  action: ROUTES.API.CONNECTIONS,
                  method: 'POST',
                  encType: 'application/json',
                  navigate: false,
                });
                handleNavigateToListView();
              }
            }}
          >
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}
