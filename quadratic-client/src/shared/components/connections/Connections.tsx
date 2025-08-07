import {
  getToggleShowConnectionDemoAction,
  type CreateConnectionAction,
  type DeleteConnectionAction,
  type ToggleShowConnectionDemoAction,
  type UpdateConnectionAction,
} from '@/routes/api.connections';
import { ConnectionDetails } from '@/shared/components/connections/ConnectionDetails';
import { ConnectionFormCreate, ConnectionFormEdit } from '@/shared/components/connections/ConnectionForm';
import { connectionsByType } from '@/shared/components/connections/connectionsByType';
import { ConnectionsList } from '@/shared/components/connections/ConnectionsList';
import { ConnectionsNew } from '@/shared/components/connections/ConnectionsNew';
import { ConnectionsSidebar } from '@/shared/components/connections/ConnectionsSidebar';
import { ArrowBackIcon } from '@/shared/components/Icons';
import { useUpdateQueryStringValueWithoutNavigation } from '@/shared/hooks/useUpdateQueryStringValueWithoutNavigation';
import { Button } from '@/shared/shadcn/ui/button';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import type { ConnectionList, ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useCallback, useState } from 'react';
import { useFetchers, useSearchParams, useSubmit } from 'react-router';

export type ConnectionsListConnection = ConnectionList[0] & {
  disabled?: boolean;
};
type Props = {
  teamUuid: string;
  sshPublicKey: string;
  staticIps: string[] | null;
  connections: ConnectionsListConnection[];
  connectionsAreLoading?: boolean;
};

export type NavigateToListView = () => void;
export type NavigateToView = (props: { connectionUuid: string; connectionType: ConnectionType }) => void;
export type NavigateToCreateView = (type: ConnectionType) => void;

type ConnectionState =
  | { view: 'edit'; uuid: string; type: ConnectionType }
  | { view: 'details'; uuid: string; type: ConnectionType }
  | { view: 'new' }
  | { view: 'create'; type: ConnectionType }
  | { view: 'list' };

export const Connections = ({ connections, connectionsAreLoading, teamUuid, staticIps, sshPublicKey }: Props) => {
  const submit = useSubmit();

  // Allow pre-loading the connection type via url params, e.g. /connections?initial-connection-type=MYSQL
  // Delete it from the url after we store it in local state
  const [searchParams] = useSearchParams();
  const initialConnectionState = getInitialConnectionState(searchParams);
  useUpdateQueryStringValueWithoutNavigation('initial-connection-type', null);
  useUpdateQueryStringValueWithoutNavigation('initial-connection-uuid', null);
  const [activeConnectionState, setActiveConnectionState] = useState<ConnectionState>(initialConnectionState);

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

  // Connection hidden? Remove it from the list
  const demoConnectionToggling = fetchers.filter(
    (fetcher) =>
      isJsonObject(fetcher.json) && fetcher.json.action === 'toggle-show-connection-demo' && fetcher.state !== 'idle'
  );
  if (demoConnectionToggling.length) {
    const activeFetcher = demoConnectionToggling.slice(-1)[0];
    if ((activeFetcher.json as ToggleShowConnectionDemoAction).showConnectionDemo === false) {
      connections = connections.filter((c) => c.isDemo !== true);
    } else {
      connections = [
        ...connections,
        // We don't know the name of the demo connection, so we just use the [Demo] prefix as a placeholder
        { name: '[Demo]', type: 'POSTGRES', uuid: 'xxx', createdDate: new Date().toISOString(), isDemo: true },
      ];
    }
  }

  /**
   * Navigation
   */

  const handleShowConnectionDemo = useCallback(
    (showConnectionDemo: boolean) => {
      const { json, options } = getToggleShowConnectionDemoAction(teamUuid, showConnectionDemo);
      submit(json, { ...options, navigate: false });
    },
    [submit, teamUuid]
  );
  const handleNavigateToListView: NavigateToListView = useCallback(() => {
    setActiveConnectionState({ view: 'list' });
  }, []);
  const handleNavigateToCreateView: NavigateToCreateView = useCallback((connectionType) => {
    setActiveConnectionState({ view: 'create', type: connectionType });
  }, []);
  const handleNavigateToEditView: NavigateToView = useCallback(({ connectionType, connectionUuid }) => {
    setActiveConnectionState({ view: 'edit', uuid: connectionUuid, type: connectionType });
  }, []);
  const handleNavigateToDetailsView: NavigateToView = useCallback(({ connectionType, connectionUuid }) => {
    setActiveConnectionState({ view: 'details', type: connectionType, uuid: connectionUuid });
  }, []);
  const handleNavigateToNewView = useCallback(() => {
    setActiveConnectionState({ view: 'new' });
  }, []);

  return (
    <div className={'grid-cols-12 gap-12 md:grid'}>
      <div className="col-span-8">
        {activeConnectionState.view === 'edit' ? (
          <>
            <ConnectionHeader onBack={handleNavigateToListView}>
              Edit {connectionsByType[activeConnectionState.type].name} connection
            </ConnectionHeader>
            <ConnectionFormEdit
              connectionUuid={activeConnectionState.uuid}
              connectionType={activeConnectionState.type}
              handleNavigateToListView={handleNavigateToListView}
              teamUuid={teamUuid}
            />
          </>
        ) : activeConnectionState.view === 'details' ? (
          <>
            <ConnectionHeader onBack={handleNavigateToListView}>
              Browse {connectionsByType[activeConnectionState.type].name} schema
            </ConnectionHeader>
            <ConnectionDetails
              connectionUuid={activeConnectionState.uuid}
              connectionType={activeConnectionState.type}
              teamUuid={teamUuid}
            />
          </>
        ) : activeConnectionState.view === 'new' ? (
          <>
            <ConnectionHeader onBack={handleNavigateToListView}>New connection</ConnectionHeader>
            <ConnectionsNew handleNavigateToCreateView={handleNavigateToCreateView} />
          </>
        ) : activeConnectionState.view === 'create' ? (
          <>
            <ConnectionHeader onBack={handleNavigateToNewView}>
              New connection: {connectionsByType[activeConnectionState.type].name}
            </ConnectionHeader>
            <ConnectionFormCreate
              teamUuid={teamUuid}
              type={activeConnectionState.type}
              handleNavigateToListView={handleNavigateToListView}
            />
          </>
        ) : (
          <ConnectionsList
            connections={connections}
            connectionsAreLoading={connectionsAreLoading}
            handleNavigateToNewView={handleNavigateToNewView}
            handleNavigateToCreateView={handleNavigateToCreateView}
            handleNavigateToEditView={handleNavigateToEditView}
            handleNavigateToDetailsView={handleNavigateToDetailsView}
            handleShowConnectionDemo={handleShowConnectionDemo}
          />
        )}
      </div>
      <div className="col-span-4 mt-12 md:mt-0">
        <ConnectionsSidebar staticIps={staticIps} sshPublicKey={sshPublicKey} />
      </div>
    </div>
  );
};

function ConnectionHeader({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 pb-3">
      <Button variant="ghost" size="icon" onClick={onBack}>
        <ArrowBackIcon />
      </Button>
      <h3 className="text-md flex items-center justify-between gap-3">{children}</h3>
    </div>
  );
}

function getInitialConnectionState(searchParams: URLSearchParams): ConnectionState {
  const type = searchParams.get('initial-connection-type');
  const uuid = searchParams.get('initial-connection-uuid');
  if (
    type === 'MYSQL' ||
    type === 'POSTGRES' ||
    type === 'MSSQL' ||
    type === 'SNOWFLAKE' ||
    type === 'COCKROACHDB' ||
    type === 'BIGQUERY' ||
    type === 'MARIADB' ||
    type === 'SUPABASE' ||
    type === 'NEON'
  ) {
    if (uuid) {
      return { view: 'edit', uuid, type };
    }
    return { view: 'create', type };
  }

  return { view: 'list' };
}
