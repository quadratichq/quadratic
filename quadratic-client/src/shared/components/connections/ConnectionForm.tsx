import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { getCreateConnectionAction, getUpdateConnectionAction } from '@/routes/_api.connections';
import { connectionsByType } from '@/shared/components/connections/connectionsByType';
import { Skeleton } from '@/shared/shadcn/ui/skeleton';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useEffect } from 'react';
import { useFetcher, useSubmit } from 'react-router-dom';

type ConnectionFormData = {
  name: string;
  type: ConnectionType;
  typeDetails: ApiTypes['/v0/connections/:uuid.GET.response']['typeDetails'];
};

export type ConnectionFormProps = {
  handleNavigateToListView: () => void;
  handleSubmitForm: (formData: ConnectionFormData) => void;
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

  const handleSubmitForm = (formData: ConnectionFormData) => {
    const data = getCreateConnectionAction(formData, teamUuid);
    submit(data, { action: '/_api/connections', method: 'POST', encType: 'application/json', navigate: false });
    handleNavigateToListView();
  };

  const props: ConnectionFormProps = {
    handleNavigateToListView,
    handleSubmitForm,
  };

  return (
    <>
      <ConnectionFormHeader type={type}>Create</ConnectionFormHeader>
      <ConnectionForm type={type} props={props} />
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
      fetcher.load(`/_api/connections?connection-uuid=${connectionUuid}`);
    }
  }, [fetcher, connectionUuid]);

  const handleSubmitForm = (formData: ConnectionFormData) => {
    // Enhancement: if nothing changed, don't submit. Just navigate back

    const data = getUpdateConnectionAction(connectionUuid, formData);
    submit(data, { action: '/_api/connections', method: 'POST', encType: 'application/json', navigate: false });
    handleNavigateToListView();
  };

  return (
    <>
      <ConnectionFormHeader type={connectionType}>Edit</ConnectionFormHeader>
      {fetcher.data?.ok ? (
        <ConnectionForm
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

function ConnectionForm({ type, props }: { type: ConnectionType; props: ConnectionFormProps }) {
  const { Form } = connectionsByType[type];
  return <Form {...props} />;
}

function ConnectionFormHeader({ type, children }: { type: ConnectionType; children: React.ReactNode }) {
  const { name } = connectionsByType[type];
  return (
    <h3 className="text-md flex gap-3 py-4">
      <LanguageIcon language={type} /> {children} {name} connection
    </h3>
  );
}
