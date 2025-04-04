import { getDeleteConnectionAction } from '@/routes/api.connections';
import { connectionClient } from '@/shared/api/connectionClient';
import type { ConnectionFormValues } from '@/shared/components/connections/connectionsByType';
import { SpinnerIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { CheckCircledIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useSubmit } from 'react-router-dom';

type ConnectionState = 'idle' | 'loading' | 'success' | 'error';

export function ConnectionFormActions({
  connectionType,
  connectionUuid,
  form,
  handleNavigateToListView,
  handleSubmitForm,
}: {
  connectionType: ConnectionType;
  connectionUuid: string | undefined;
  form: UseFormReturn<any>;
  handleNavigateToListView: () => void;
  handleSubmitForm: (formValues: ConnectionFormValues) => void;
}) {
  const submit = useSubmit();
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [previousState, setPreviousState] = useState<ConnectionState>('idle');
  const [connectionError, setConnectionError] = useState<string>('');
  const [formDataSnapshot, setFormDataSnapshot] = useState<{ [key: string]: any }>({});

  const formData = form.watch();

  // If the user changed some data, update the snapshot but keep error state
  useEffect(() => {
    const hasChanges = Object.keys(formData).some((key) => formData[key] !== formDataSnapshot[key]);
    if (hasChanges) {
      // Only reset to idle if not in error state
      if (connectionState !== 'error') {
        setConnectionState('idle');
      }
      setFormDataSnapshot(formData);
    }
  }, [formData, formDataSnapshot, connectionState]);

  const testConnection = async (values: ConnectionFormValues) => {
    const { name, type, ...typeDetails } = values;
    mixpanel.track('[Connections].test', { type });

    // Save the current state before changing to loading
    setPreviousState(connectionState);
    setConnectionState('loading');

    try {
      const { connected, message } = await connectionClient.test.run({
        type,
        typeDetails,
      });
      setConnectionError(connected === false && message ? message : '');
      setConnectionState(connected ? 'success' : 'error');
      return connected;
    } catch (e) {
      setConnectionError('Network error: failed to make connection.');
      setConnectionState('error');
      return false;
    }
  };

  // Determine button variant based on state
  const getButtonVariant = () => {
    if (connectionState === 'success') return 'success';
    if (connectionState === 'error') return 'destructive';
    if (connectionState === 'loading' && previousState === 'error') return 'destructive';
    return 'default';
  };

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex flex-col gap-1">
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" onClick={handleNavigateToListView} type="button">
            Cancel
          </Button>

          {connectionUuid ? (
            // For existing connections: Test and Save
            <Button
              type="button"
              disabled={connectionState === 'loading'}
              variant={getButtonVariant()}
              onClick={form.handleSubmit(async (values: ConnectionFormValues) => {
                const success = await testConnection(values);
                if (success) {
                  // Brief delay to show success state before submitting
                  setTimeout(() => {
                    handleSubmitForm(values);
                  }, 200);
                }
              })}
            >
              {connectionState === 'loading' ? (
                <>
                  <SpinnerIcon className="mr-1 text-white" />
                  Test and Save
                </>
              ) : connectionState === 'success' ? (
                <>
                  <CheckCircledIcon className="mr-1" /> Success
                </>
              ) : connectionState === 'error' ? (
                <>Failed. Try again.</>
              ) : (
                'Test and Save'
              )}
            </Button>
          ) : (
            // For new connections: Test and Create
            <Button
              type="button"
              disabled={connectionState === 'loading'}
              variant={getButtonVariant()}
              onClick={form.handleSubmit(async (values: ConnectionFormValues) => {
                const success = await testConnection(values);
                if (success) {
                  // Brief delay to show success state before submitting
                  setTimeout(() => {
                    handleSubmitForm(values);
                  }, 200);
                }
              })}
            >
              {connectionState === 'loading' ? (
                <>
                  <SpinnerIcon className="mr-1 text-white" />
                  Test and Create
                </>
              ) : connectionState === 'success' ? (
                <>
                  <CheckCircledIcon className="mr-1" /> Success
                </>
              ) : connectionState === 'error' ? (
                <>Try again.</>
              ) : (
                'Test and Create'
              )}
            </Button>
          )}
        </div>
        {connectionState === 'error' && (
          <div className="mt-2 font-mono text-xs text-destructive">
            {connectionError}{' '}
            <a
              href="https://www.quadratichq.com/contact"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline hover:text-blue-700"
            >
              Need help? Contact us.
            </a>
          </div>
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
