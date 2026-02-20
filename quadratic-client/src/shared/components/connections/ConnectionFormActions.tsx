import { getDeleteConnectionAction } from '@/routes/api.connections';
import { useConfirmDialog } from '@/shared/components/ConfirmProvider';
import { SKIP_TEST_BUTTON_NAME } from '@/shared/components/connections/ConnectionForm';
import { ErrorIcon } from '@/shared/components/Icons';
import { CONTACT_URL } from '@/shared/constants/urls';
import { Alert, AlertDescription, AlertTitle } from '@/shared/shadcn/ui/alert';
import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useFetchers, useSubmit } from 'react-router';

export function ConnectionFormActions({
  connectionType,
  connectionUuid,
  form,
  handleCancelForm,
  handleNavigateToListView,
  teamUuid,
}: {
  connectionType: ConnectionType;
  connectionUuid: string | undefined;
  form: UseFormReturn<any>;
  handleCancelForm: () => void;
  handleNavigateToListView: () => void;
  teamUuid: string;
}) {
  const fetchers = useFetchers();
  const isCreatingOrUpdatingConnection = fetchers.some(
    (fetcher) =>
      isJsonObject(fetcher.json) &&
      (fetcher.json.action === 'create-connection' || fetcher.json.action === 'update-connection') &&
      fetcher.state !== 'idle'
  );
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
  const isSubmitting = form.formState.isSubmitting || isCreatingOrUpdatingConnection;

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
                    trackEvent('[Connections].delete', { type: connectionType });
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

          <Button variant="outline" onClick={handleCancelForm} type="button" disabled={isSubmitting}>
            Cancel
          </Button>

          <Button type="submit" disabled={isSubmitting} loading={isSubmitting}>
            {connectionUuid ? 'Save changes' : 'Create'}
          </Button>
        </div>
        {dbConnectionError && (
          <div className="mt-4 flex flex-col gap-2">
            <Alert variant="destructive">
              <ErrorIcon />
              <AlertTitle>A test to your connection failed</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                <span>
                  Check the details and try again. Or,{' '}
                  <button type="submit" name={SKIP_TEST_BUTTON_NAME} className="font-medium text-primary">
                    {connectionUuid ? 'save changes' : 'create the connection'} without testing
                  </button>
                  .
                </span>
                <div className="mt-1 w-full whitespace-pre-wrap break-words font-mono text-xs">
                  {dbConnectionError.message}
                </div>
              </AlertDescription>
            </Alert>
            <p className="text-xs text-muted-foreground">
              Need help?{' '}
              <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" className="underline">
                Contact us.
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
