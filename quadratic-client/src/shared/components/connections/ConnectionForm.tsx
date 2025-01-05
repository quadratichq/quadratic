import { getCreateConnectionAction, getUpdateConnectionAction } from '@/routes/api.connections';
import { ConnectionFormActions } from '@/shared/components/connections/ConnectionFormActions';
import { ConnectionHeader } from '@/shared/components/connections/ConnectionHeader';
import type { ConnectionFormValues} from '@/shared/components/connections/connectionsByType';
import { connectionsByType } from '@/shared/components/connections/connectionsByType';
import { ROUTES } from '@/shared/constants/routes';
import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import mixpanel from 'mixpanel-browser';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useEffect } from 'react';
import { useFetcher, useSubmit } from 'react-router-dom';

export type ConnectionFormProps = {
  handleNavigateToListView: () => void;
  handleSubmitForm: (formValues: ConnectionFormValues) => void;
  connection?: ApiTypes['/v0/connections/:uuid.GET.response'];
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
    const data = getCreateConnectionAction({ name, type, typeDetails }, teamUuid);
    submit(data, { action: ROUTES.API.CONNECTIONS, method: 'POST', encType: 'application/json', navigate: false });
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
      <ConnectionFormWrapper type={type} props={props} />
    </>
  );
}

export function ConnectionFormEdit({
  connectionUuid,
  connectionType,
  handleNavigateToListView,
}: {
  connectionUuid: string;
  connectionType: ConnectionType;
  handleNavigateToListView: () => void;
}) {
  const submit = useSubmit();
  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data === undefined) {
      fetcher.load(`${ROUTES.API.CONNECTIONS}?connection-uuid=${connectionUuid}`);
    }
  }, [fetcher, connectionUuid]);

  const handleSubmitForm = (formValues: ConnectionFormValues) => {
    // Enhancement: if nothing changed, don't submit. Just navigate back
    const { name, type, ...typeDetails } = formValues;
    mixpanel.track('[Connections].edit', { type });
    const data = getUpdateConnectionAction(connectionUuid, { name, typeDetails });
    submit(data, { action: ROUTES.API.CONNECTIONS, method: 'POST', encType: 'application/json', navigate: false });
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

function ConnectionFormWrapper({ type, props }: { type: ConnectionType; props: ConnectionFormProps }) {
  const { ConnectionForm, useConnectionForm } = connectionsByType[type];
  const { form } = useConnectionForm(props.connection);

  return (
    <ConnectionForm handleSubmitForm={props.handleSubmitForm} form={form}>
      <ConnectionFormActions
        form={form}
        handleNavigateToListView={props.handleNavigateToListView}
        connectionUuid={props.connection?.uuid}
        connectionType={type}
      />
    </ConnectionForm>
  );
}
