import { getCreateConnectionAction, getUpdateConnectionAction } from '@/routes/api.connections';
import { connectionClient } from '@/shared/api/connectionClient';
import { ConnectionFormActions } from '@/shared/components/connections/ConnectionFormActions';
import { ConnectionHeader } from '@/shared/components/connections/ConnectionHeader';
import type { ConnectionFormValues } from '@/shared/components/connections/connectionsByType';
import { connectionsByType } from '@/shared/components/connections/connectionsByType';
import { ROUTES } from '@/shared/constants/routes';
import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import mixpanel from 'mixpanel-browser';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useEffect } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { useFetcher, useSubmit } from 'react-router';

export type ConnectionFormProps = {
  handleNavigateToListView: () => void;
  handleSubmitForm: (formValues: ConnectionFormValues) => void;
  connection?: ApiTypes['/v0/teams/:uuid/connections/:connectionUuid.GET.response'];
};

export function ConnectionFormCreate({
  teamUuid,
  type,
  handleNavigateToListView,
}: {
  teamUuid: string;
  type: ConnectionType;
  handleNavigateToListView: () => void;
}) {
  const submit = useSubmit();

  const handleSubmitForm = (formValues: ConnectionFormValues) => {
    const { name, type, ...typeDetails } = formValues;
    mixpanel.track('[Connections].create', { type });
    const { json, options } = getCreateConnectionAction({ name, type, typeDetails }, teamUuid);
    submit(json, { ...options, navigate: false });
    handleNavigateToListView();
  };

  const props: ConnectionFormProps = {
    handleNavigateToListView,
    handleSubmitForm,
  };

  return (
    <>
      <ConnectionHeader type={type} handleNavigateToListView={handleNavigateToListView}>
        Create
      </ConnectionHeader>
      <ConnectionFormWrapper teamUuid={teamUuid} type={type} props={props} />
    </>
  );
}

export function ConnectionFormEdit({
  connectionUuid,
  connectionType,
  handleNavigateToListView,
  teamUuid,
}: {
  connectionUuid: string;
  connectionType: ConnectionType;
  handleNavigateToListView: () => void;
  teamUuid: string;
}) {
  const submit = useSubmit();
  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data === undefined) {
      fetcher.load(ROUTES.API.CONNECTIONS.GET({ teamUuid, connectionUuid }));
    }
  }, [fetcher, connectionUuid, teamUuid]);

  const handleSubmitForm = (formValues: ConnectionFormValues) => {
    // Enhancement: if nothing changed, don't submit. Just navigate back
    const { name, type, ...typeDetails } = formValues;
    mixpanel.track('[Connections].edit', { type });
    const { json, options } = getUpdateConnectionAction(connectionUuid, teamUuid, { name, typeDetails });
    submit(json, { ...options, navigate: false });
    handleNavigateToListView();
  };

  return (
    <>
      <ConnectionHeader type={connectionType} handleNavigateToListView={handleNavigateToListView}>
        Edit
      </ConnectionHeader>
      {fetcher.data?.ok ? (
        <ConnectionFormWrapper
          type={fetcher.data.connection.type}
          teamUuid={teamUuid}
          props={{
            connection: fetcher.data.connection,
            handleNavigateToListView,
            handleSubmitForm,
          }}
        />
      ) : (
        <div className="gap-2 pt-2">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      )}
    </>
  );
}

export const SKIP_TEST_BUTTON_NAME = 'skip-test';
function ConnectionFormWrapper({
  teamUuid,
  type,
  props,
}: {
  teamUuid: string;
  type: ConnectionType;
  props: ConnectionFormProps;
}) {
  const { ConnectionForm } = connectionsByType[type];
  const { form } = connectionsByType[type].useConnectionForm(props.connection);

  // This is a middleware that tests the connection before saving
  const handleSubmitMiddleware: SubmitHandler<ConnectionFormValues> = async (formValues, event: any) => {
    if (event?.nativeEvent?.submitter?.name === SKIP_TEST_BUTTON_NAME) {
      props.handleSubmitForm(formValues);
      return;
    }

    const { name, type, ...typeDetails } = formValues;

    try {
      const { connected, message } = await connectionClient.test.run({
        type,
        typeDetails,
        teamUuid,
      });
      if (connected === false) {
        form.setError('root', { message: message ?? 'Unknown error' });
        return;
      }

      // If it worked, update the connection
      props.handleSubmitForm(formValues);
    } catch (e) {
      console.error(e);
      form.setError('root', { message: 'Network error: failed to make connection.' });
      return;
    }
  };

  return (
    <ConnectionForm handleSubmitForm={handleSubmitMiddleware} form={form}>
      <ConnectionFormActions
        form={form}
        handleNavigateToListView={props.handleNavigateToListView}
        connectionUuid={props.connection?.uuid}
        connectionType={type}
        teamUuid={teamUuid}
      />
    </ConnectionForm>
  );
}
