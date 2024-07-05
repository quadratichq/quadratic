import { CreateConnectionAction, DeleteConnectionAction, UpdateConnectionAction } from '@/routes/api.connections';
import { ConnectionFormCreate, ConnectionFormEdit } from '@/shared/components/connections/ConnectionForm';
import { ConnectionsList } from '@/shared/components/connections/ConnectionsList';
import { ConnectionsSidebar } from '@/shared/components/connections/ConnectionsSidebar';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useState } from 'react';
import { useFetchers } from 'react-router-dom';

export type ConnectionsListConnection = {
  uuid: string;
  name: string;
  createdDate: string;
  type: ConnectionType;
  disabled?: boolean;
};
type Props = {
  teamUuid: string;
  staticIps: string[] | null;
  connections: ConnectionsListConnection[];
  connectionsAreLoading?: boolean;
};
export type NavigateToEditView = (props: { connectionUuid: string; connectionType: ConnectionType }) => void;
export type NavigateToCreateView = (type: ConnectionType) => void;

export const Connections = ({ connections, connectionsAreLoading, teamUuid, staticIps }: Props) => {
  const [activeConnectionUuid, setActiveConnectionUuid] = useState<string | undefined>();
  const [activeConnectionType, setActiveConnectionType] = useState<ConnectionType | undefined>();

  /**
   * Optimistic UI
   */
  const fetchers = useFetchers();

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

  /**
   * Navigation
   */
  const handleNavigateToListView = () => {
    setActiveConnectionUuid(undefined);
    setActiveConnectionType(undefined);
  };
  const handleNavigateToCreateView: NavigateToCreateView = (connectionType) => {
    setActiveConnectionType(connectionType);
    setActiveConnectionUuid(undefined);
  };
  const handleNavigateToEditView: NavigateToEditView = ({ connectionType, connectionUuid }) => {
    setActiveConnectionUuid(connectionUuid);
    setActiveConnectionType(connectionType);
  };

  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <div className="flex flex-col gap-2 md:w-2/3">
        {activeConnectionUuid && activeConnectionType ? (
          <ConnectionFormEdit
            connectionUuid={activeConnectionUuid}
            connectionType={activeConnectionType}
            handleNavigateToListView={handleNavigateToListView}
          />
        ) : activeConnectionType ? (
          <ConnectionFormCreate
            teamUuid={teamUuid}
            type={activeConnectionType}
            handleNavigateToListView={handleNavigateToListView}
          />
        ) : (
          <ConnectionsList
            connections={connections}
            connectionsAreLoading={connectionsAreLoading}
            handleNavigateToCreateView={handleNavigateToCreateView}
            handleNavigateToEditView={handleNavigateToEditView}
          />
        )}
      </div>

      <div className="h-[1px] w-full bg-border md:h-auto md:w-[1px]"></div>

      <div className="md:w-1/3">
        <ConnectionsSidebar staticIps={staticIps} />
      </div>
    </div>
  );
};
