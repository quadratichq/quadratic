import { CreateConnectionAction, DeleteConnectionAction } from '@/routes/_api.connections';
import { ConnectionState } from '@/routes/teams.$teamUuid.connections';
import { ConnectionForm } from '@/shared/components/connections/ConnectionForm';
import { ConnectionsList } from '@/shared/components/connections/ConnectionsList';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { Dispatch, SetStateAction } from 'react';
import { useFetchers } from 'react-router-dom';
// @TODO: (connections) move this

export type ConnectionsListConnection = {
  uuid: string;
  name: string;
  createdDate: string;
  updatedDate: string;
  type: ConnectionType;
  typeDetails: any;
  disabled?: boolean;
};
type Props = {
  state: ConnectionState;
  setState: Dispatch<SetStateAction<ConnectionState>>;
  teamUuid: string;
  // null means they're loading, otherwise should be an array
  connections: ConnectionsListConnection[];
  connectionsAreLoading?: boolean;
};

export const Connections = ({ connections, connectionsAreLoading, teamUuid, state, setState }: Props) => {
  // Modify our list of connections based on optimistic
  const fetchers = useFetchers();

  // New connection being created?
  const newConnectionFetcher = fetchers.find(
    (fetcher) => isJsonObject(fetcher.json) && fetcher.json.action === 'create-connection' && fetcher.state !== 'idle'
  );
  if (newConnectionFetcher) {
    const {
      body: { name, type, typeDetails },
    } = newConnectionFetcher.json as CreateConnectionAction;
    const newItem = {
      uuid: 'optimistic',
      name,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      type,
      typeDetails,
      disabled: true,
    };
    connections = connections === null ? [newItem] : [newItem, ...connections];
  }

  // Remove any connections that are being deleted
  const connectionUuidsBeingDeleted = fetchers
    .filter(
      (fetcher) => isJsonObject(fetcher.json) && fetcher.json.action === 'delete-connection' && fetcher.state !== 'idle'
    )
    .map((fetcher) => (fetcher.json as DeleteConnectionAction).connectionUuid);
  if (connectionUuidsBeingDeleted.length) {
    connections = connections.filter((c) => !connectionUuidsBeingDeleted.includes(c.uuid));
  }

  // TODO: (connections) update the meta info for any in-flight edit

  const handleNavigateToListView = () => setState((prev) => ({ ...prev, view: { name: 'LIST' } }));
  const handleNavigateToCreateView = (type: ConnectionType) =>
    setState((prev) => ({ ...prev, view: { name: 'CREATE', type } }));
  const handleNavigateToEditView = (connectionUuid: string) =>
    setState((prev) => ({ ...prev, view: { name: 'EDIT', connectionUuid } }));

  let initialData =
    // @ts-expect-error
    state.view.name === 'EDIT' ? connections?.find((c) => c.uuid === state.view.connectionUuid) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Connetions let you pull outside data into your spreadsheets</p>
      {state.view.name === 'CREATE' && (
        <ConnectionForm type={state.view.type} handleNavigateToListView={handleNavigateToListView} />
      )}
      {state.view.name === 'EDIT' && (
        <ConnectionForm
          // @ts-expect-error
          type={initialData?.type}
          connectionUuid={state.view.connectionUuid}
          initialData={initialData}
          handleNavigateToListView={handleNavigateToListView}
        />
      )}
      {state.view.name === 'LIST' && (
        <ConnectionsList
          connections={connections}
          connectionsAreLoading={connectionsAreLoading}
          handleNavigateToCreateView={handleNavigateToCreateView}
          handleNavigateToEditView={handleNavigateToEditView}
        />
      )}
    </div>
  );
};
