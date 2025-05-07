import { getDeleteConnectionAction } from '@/routes/api.connections';

import { useConfirmDialog } from '@/shared/components/ConfirmProvider';
import { ErrorIcon, SpinnerIcon } from '@/shared/components/Icons';
import { Alert, AlertDescription, AlertTitle } from '@/shared/shadcn/ui/alert';

import { Button } from '@/shared/shadcn/ui/button';
import mixpanel from 'mixpanel-browser';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useSubmit } from 'react-router';

export function ConnectionFormActions({
  connectionType,
  connectionUuid,
  form,
  handleNavigateToListView,
  teamUuid,
}: {
  connectionType: ConnectionType;
  connectionUuid: string | undefined;
  form: UseFormReturn<any>;
  handleNavigateToListView: () => void;
  teamUuid: string;
}) {
  const submit = useSubmit();
  const confirmFn = useConfirmDialog('deleteConnection', undefined);
  const [formDataSnapshot, setFormDataSnapshot] = useState<{ [key: string]: any }>({});
  const formData = form.watch();

  // If the user changed some data, reset the state of the connection so they
  // know it's not valid anymore
  useEffect(() => {
    const hasChanges = Object.keys(formData).some((key) => formData[key] !== formDataSnapshot[key]);
    if (hasChanges) {
      setFormDataSnapshot(formData);
    }
  }, [formData, formDataSnapshot]);

  const dbConnectionError = form.formState.errors.root;
  const isSubmitting = form.formState.isSubmitting;

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex flex-col gap-1">
        <div className="flex w-full items-center justify-end gap-2">
          <div className="mr-auto flex items-center gap-2">
            {connectionUuid && (
              <Button
                type="button"
                variant="outline-destructive"
                className="flex-shrink-0"
                onClick={async () => {
                  if (await confirmFn()) {
                    mixpanel.track('[Connections].delete', { type: connectionType });
                    const { json, options } = getDeleteConnectionAction(connectionUuid, teamUuid);
                    submit(json, {
                      ...options,
                      navigate: false,
                    });
                    handleNavigateToListView();
                  }
                }}
              >
                Delete
              </Button>
            )}
          </div>
          {isSubmitting && <SpinnerIcon className="mr-2 text-primary" />}
          <Button variant="outline" onClick={handleNavigateToListView} type="button" disabled={isSubmitting}>
            Cancel
          </Button>

          <Button type="submit" disabled={isSubmitting}>
            {connectionUuid ? 'Save changes' : 'Create'}
          </Button>
        </div>
        {dbConnectionError && (
          <Alert variant="destructive" className="mt-4">
            <ErrorIcon />
            <AlertTitle>Failed to {connectionUuid ? 'save changes' : 'create'}</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span className="mb-1">The connection is not reachable. The server returned this error:</span>
              <span className="font-mono text-xs">{dbConnectionError.message}</span>
              <span>
                Need help?{' '}
                <a
                  href="https://www.quadratichq.com/contact"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Contact us.
                </a>
              </span>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
