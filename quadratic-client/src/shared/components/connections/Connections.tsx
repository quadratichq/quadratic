import { CreateConnectionAction, DeleteConnectionAction, UpdateConnectionAction } from '@/routes/_api.connections';
import { ConnectionState } from '@/routes/teams.$teamUuid.connections';
import { ConnectionFormCreate, ConnectionFormEdit } from '@/shared/components/connections/ConnectionForm';
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
  staticIps: string[] | null;
  // null means they're loading, otherwise should be an array
  connections: ConnectionsListConnection[];
  connectionsAreLoading?: boolean;
};

export const Connections = ({ connections, connectionsAreLoading, teamUuid, staticIps, state, setState }: Props) => {
  // Modify our list of connections based on optimistic
  const fetchers = useFetchers();

  // TODO(jimniels): implement in the UI
  console.log('staticIps', staticIps);

  // Connection created? Add it to the list of connections
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

  // Connection deleted? Remove it from the list
  const connectionUuidsBeingDeleted = fetchers
    .filter(
      (fetcher) => isJsonObject(fetcher.json) && fetcher.json.action === 'delete-connection' && fetcher.state !== 'idle'
    )
    .map((fetcher) => (fetcher.json as DeleteConnectionAction).connectionUuid);
  if (connectionUuidsBeingDeleted.length) {
    connections = connections.filter((c) => !connectionUuidsBeingDeleted.includes(c.uuid));
  }

  // Connection updated? Update the meta info that will show up in the list
  const connectionsBeingEdited = fetchers.filter(
    (fetcher) => isJsonObject(fetcher.json) && fetcher.json.action === 'update-connection' && fetcher.state !== 'idle'
  );
  if (connectionsBeingEdited.length) {
    connections = connections.map((connection) => {
      const fetcherMatch = connectionsBeingEdited.find(
        (fetcher) => (fetcher.json as UpdateConnectionAction).connectionUuid === connection.uuid
      );
      if (fetcherMatch) {
        const {
          body: { name },
        } = fetcherMatch.json as UpdateConnectionAction;
        return { ...connection, disabled: true, name };
      }
      return connection;
    });
  }

  const handleNavigateToListView = () => setState((prev) => ({ ...prev, view: { name: 'LIST' } }));
  const handleNavigateToCreateView = (type: ConnectionType) =>
    setState((prev) => ({ ...prev, view: { name: 'CREATE', type } }));
  const handleNavigateToEditView = (connectionUuid: string) =>
    setState((prev) => ({ ...prev, view: { name: 'EDIT', connectionUuid } }));

  return (
    <div className="flex flex-col gap-2">
      {state.view.name === 'CREATE' && (
        <ConnectionFormCreate type={state.view.type} handleNavigateToListView={handleNavigateToListView} />
      )}
      {state.view.name === 'EDIT' && (
        <ConnectionFormEdit
          // @ts-expect-error
          connection={connections?.find((c) => c.uuid === state.view.connectionUuid)}
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

/*

<DialogHeader>
        <ConnectionsBreadcrumb />
        <DialogTitle>{connectionName} connection</DialogTitle>
        <DialogDescription>
          For more information on {connectionName} connections,{' '}
          <a href={connectionDocsLink} target="_blank" rel="noreferrer" className="underline hover:text-primary">
            read the docs
          </a>
        </DialogDescription>
      </DialogHeader>


*/
