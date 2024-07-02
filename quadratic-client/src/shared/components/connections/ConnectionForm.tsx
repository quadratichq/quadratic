import { getCreateConnectionAction, getUpdateConnectionAction } from '@/routes/_api.connections';
import { ConnectionFormTypeMysql } from '@/shared/components/connections/ConnectionFormTypeMysql';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { Connection, ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useSubmit } from 'react-router-dom';
import { ConnectionFormTypePostgres } from './ConnectionFormTypePostgres';

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

  return <ConnectionForm type={type} props={props} />;
}

export function ConnectionFormEdit({
  connection,
  handleNavigateToListView,
}: {
  connection: Connection;
  handleNavigateToListView: () => void;
}) {
  const submit = useSubmit();

  const handleSubmitForm = (formData: ConnectionFormData) => {
    // Enhancement: if nothing changed, don't submit. Just navigate back

    const data = getUpdateConnectionAction(connection.uuid, formData);
    submit(data, { action: '/_api/connections', method: 'POST', encType: 'application/json', navigate: false });
    handleNavigateToListView();
  };

  const props: ConnectionFormProps = {
    connection,
    handleNavigateToListView,
    handleSubmitForm,
  };

  return <ConnectionForm type={connection.type} props={props} />;
}

function ConnectionForm({ type, props }: { type: ConnectionType; props: ConnectionFormProps }) {
  switch (type) {
    case 'POSTGRES':
      return <ConnectionFormTypePostgres {...props} />;
    case 'MYSQL':
      return <ConnectionFormTypeMysql {...props} />;
    default:
      // This should never happen. Log to sentry?
      throw new Error('Unknown form type');
  }
}
