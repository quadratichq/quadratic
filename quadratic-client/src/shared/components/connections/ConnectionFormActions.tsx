import { getDeleteConnectionAction } from '@/routes/_api.connections';
import { TestConnectionResponse } from '@/shared/api/connectionClient';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { CircularProgress } from '@mui/material';
import { CheckCircledIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useSubmit } from 'react-router-dom';

type ConnectionState = 'idle' | 'loading' | 'success' | 'error';
export type ValidateThenTestConnection = () => Promise<() => Promise<TestConnectionResponse>>;

export function ConnectionFormActions({
  connectionUuid,
  form,
  handleNavigateToListView,
  validateThenTest,
}: {
  connectionUuid: string | undefined;
  form: UseFormReturn<any>;
  handleNavigateToListView: () => void;
  validateThenTest: ValidateThenTestConnection;
}) {
  const submit = useSubmit();
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
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex w-full justify-end gap-2">
        <div className="mr-auto flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={connectionState === 'loading'}
            onClick={() => {
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
            {/* {connectionState === 'idle' && <Type>Untested</Type>} */}
            {connectionState === 'success' && <CheckCircledIcon />}
            {connectionState === 'error' && <ExclamationTriangleIcon />}
          </div>
        </div>

        <Button variant="outline" onClick={handleNavigateToListView} type="button">
          Cancel
        </Button>
        <Button type="submit">{connectionUuid ? 'Save changes' : 'Create'}</Button>
      </div>
      {connectionState === 'error' && <div className="mt-2 font-mono text-xs text-destructive">{connectionError}</div>}

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
                const data = getDeleteConnectionAction(connectionUuid);
                submit(data, {
                  // TODO: don't hard-code these routes
                  action: '/_api/connections',
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

/*


        
        

        <Button disabled={isSubmitting} form={CONNECTION_FORM_ID} type="submit">
          {isEdit ? 'Save changes' : 'Create'}
        </Button>

*/
