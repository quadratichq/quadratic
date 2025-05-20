import type { CodeCellLanguage } from '@/app/quadratic-core-types';
import type { CreateConnectionAction, DeleteConnectionAction, UpdateConnectionAction } from '@/routes/api.connections';
import { ConnectionDetails } from '@/shared/components/connections/ConnectionDetails';
import { ConnectionFormCreate, ConnectionFormEdit } from '@/shared/components/connections/ConnectionForm';
import { ConnectionsList } from '@/shared/components/connections/ConnectionsList';
import { ConnectionsSidebar } from '@/shared/components/connections/ConnectionsSidebar';
import { useUpdateQueryStringValueWithoutNavigation } from '@/shared/hooks/useUpdateQueryStringValueWithoutNavigation';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useState } from 'react';
import { useFetchers, useSearchParams } from 'react-router';

export type ConnectionsListConnection = {
  uuid: string;
  name: string;
  createdDate: string;
  type: ConnectionType;
  disabled?: boolean;
};
type Props = {
  teamUuid: string;
  sshPublicKey: string;
  staticIps: string[] | null;
  connections: ConnectionsListConnection[];
  connectionsAreLoading?: boolean;
  // If this is present, we're in the app and we'll do stuff slightly differently
  handleNavigateToDetailsViewOverride?: (language: CodeCellLanguage) => void;
};
export type NavigateToView = (props: { connectionUuid: string; connectionType: ConnectionType }) => void;
export type NavigateToCreateView = (type: ConnectionType) => void;

export const Connections = ({
  connections,
  connectionsAreLoading,
  teamUuid,
  staticIps,
  handleNavigateToDetailsViewOverride,
  sshPublicKey,
}: Props) => {
  // Allow pre-loading the connection type via url params, e.g. /connections?initial-connection-type=MYSQL
  // Delete it from the url after we store it in local state
  const [searchParams] = useSearchParams();
  const initialConnectionType = searchParams.get('initial-connection-type');
  const initialConnectionUuid = searchParams.get('initial-connection-uuid');
  useUpdateQueryStringValueWithoutNavigation('initial-connection-type', null);
  useUpdateQueryStringValueWithoutNavigation('initial-connection-uuid', null);

  const [activeConnectionState, setActiveConnectionState] = useState<
    { uuid: string; view: 'edit' | 'details' } | undefined
  >(initialConnectionUuid ? { uuid: initialConnectionUuid, view: 'edit' } : undefined);
  const [activeConnectionType, setActiveConnectionType] = useState<ConnectionType | undefined>(
    initialConnectionType === 'MYSQL' ||
      initialConnectionType === 'POSTGRES' ||
      initialConnectionType === 'MSSQL' ||
      initialConnectionType === 'SNOWFLAKE'
      ? initialConnectionType
      : undefined
  );

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
    setActiveConnectionState(undefined);
    setActiveConnectionType(undefined);
  };
  const handleNavigateToCreateView: NavigateToCreateView = (connectionType) => {
    setActiveConnectionType(connectionType);
    setActiveConnectionState(undefined);
  };
  const handleNavigateToEditView: NavigateToView = ({ connectionType, connectionUuid }) => {
    setActiveConnectionState({ uuid: connectionUuid, view: 'edit' });
    setActiveConnectionType(connectionType);
  };
  const handleNavigateToDetailsView: NavigateToView = ({ connectionType, connectionUuid }) => {
    // If we're in the app, insert a query on the sheet.
    if (handleNavigateToDetailsViewOverride) {
      handleNavigateToDetailsViewOverride({ Connection: { kind: connectionType, id: connectionUuid } });
      return;
    }
    // Otherwise we're on the dashboard, so navigate to the connection details
    setActiveConnectionState({ uuid: connectionUuid, view: 'details' });
    setActiveConnectionType(connectionType);
  };

  return (
    <div className={'grid-cols-12 gap-12 md:grid'}>
      <div className="col-span-8">
        {activeConnectionState && activeConnectionType ? (
          activeConnectionState.view === 'edit' ? (
            <ConnectionFormEdit
              connectionUuid={activeConnectionState.uuid}
              connectionType={activeConnectionType}
              handleNavigateToListView={handleNavigateToListView}
              teamUuid={teamUuid}
            />
          ) : (
            <ConnectionDetails
              connectionUuid={activeConnectionState.uuid}
              connectionType={activeConnectionType}
              handleNavigateToListView={handleNavigateToListView}
              teamUuid={teamUuid}
            />
          )
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
            handleNavigateToDetailsView={handleNavigateToDetailsView}
          />
        )}
      </div>
      <div className="col-span-4 mt-12 md:mt-0">
        <ConnectionsSidebar staticIps={staticIps} sshPublicKey={sshPublicKey} />
      </div>
    </div>
  );
};
