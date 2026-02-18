import { isDatabaseConnection } from '@/app/helpers/codeCellLanguage';
import {
  getToggleShowConnectionDemoAction,
  type CreateConnectionAction,
  type DeleteConnectionAction,
  type ToggleShowConnectionDemoAction,
  type UpdateConnectionAction,
} from '@/routes/api.connections';
import { ConnectionDetails } from '@/shared/components/connections/ConnectionDetails';
import {
  ConnectionFormCreate,
  ConnectionFormEdit,
  type OnConnectionCreatedCallback,
} from '@/shared/components/connections/ConnectionForm';
import {
  connectionsByType,
  potentialConnectionsByType,
  type PotentialConnectionType,
} from '@/shared/components/connections/connectionsByType';
import { ConnectionsProvider } from '@/shared/components/connections/ConnectionsContext';
import { ConnectionsList } from '@/shared/components/connections/ConnectionsList';
import { ConnectionsNew } from '@/shared/components/connections/ConnectionsNew';
import { ConnectionsPotential } from '@/shared/components/connections/ConnectionsPotential';
import { ConnectionsSidebar } from '@/shared/components/connections/ConnectionsSidebar';
import { useUpdateQueryStringValueWithoutNavigation } from '@/shared/hooks/useUpdateQueryStringValueWithoutNavigation';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/shadcn/ui/breadcrumb';
import { TooltipProvider } from '@/shared/shadcn/ui/tooltip';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import type { ConnectionList, ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { Fragment, memo, useCallback, useMemo, useState } from 'react';
import { useFetchers, useSearchParams, useSubmit } from 'react-router';

export type ConnectionsListConnection = ConnectionList[0] & {
  disabled?: boolean;
};
export type OnConnectionSelectedCallback = (
  connectionUuid: string,
  connectionType: ConnectionType,
  connectionName: string
) => void;

type Props = {
  teamUuid: string;
  sshPublicKey: string;
  staticIps: string[] | null;
  connections: ConnectionsListConnection[];
  connectionsAreLoading?: boolean;
  /** Hide the sidebar (useful when rendering outside of RecoilRoot) */
  hideSidebar?: boolean;
  /** Open directly to the 'new' view */
  initialView?: 'new' | 'list';
  /** Called when a new connection is created successfully */
  onConnectionCreated?: OnConnectionCreatedCallback;
  /** Called when an existing connection is selected from the list (in-app only) */
  onConnectionSelected?: OnConnectionSelectedCallback;
  /** Open directly to create a specific connection type */
  initialConnectionType?: ConnectionType;
  /** Open directly to edit a specific connection */
  initialConnectionUuid?: string;
};

export type NavigateToListView = () => void;
export type NavigateToView = (props: { connectionUuid: string; connectionType: ConnectionType }) => void;
export type PlaidCategory = 'Banks' | 'Brokerages' | 'Credit Cards';
export type NavigateToCreateView = (type: ConnectionType, plaidCategory?: PlaidCategory) => void;
export type NavigateToCreatePotentialView = (type: PotentialConnectionType) => void;

type ConnectionState =
  | { view: 'edit'; uuid: string; type: ConnectionType }
  | { view: 'details'; uuid: string; type: ConnectionType }
  | { view: 'new' }
  | { view: 'create'; type: ConnectionType; plaidCategory?: PlaidCategory }
  | { view: 'create-potential'; type: PotentialConnectionType }
  | { view: 'list' };

export const Connections = ({
  connections,
  connectionsAreLoading,
  teamUuid,
  staticIps,
  sshPublicKey,
  hideSidebar,
  initialView,
  onConnectionCreated,
  onConnectionSelected,
  initialConnectionType,
  initialConnectionUuid,
}: Props) => {
  const submit = useSubmit();

  // Allow pre-loading the connection type via url params, e.g. /connections?initial-connection-type=MYSQL
  // Delete it from the url after we store it in local state
  const [searchParams] = useSearchParams();
  const initialConnectionState = getInitialConnectionStateFromProps({
    initialView,
    initialConnectionType,
    initialConnectionUuid,
    searchParams,
  });
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
        {
          name: '[Demo]',
          type: 'POSTGRES',
          uuid: 'xxx',
          createdDate: new Date().toISOString(),
          isDemo: true,
          syncedConnectionPercentCompleted: undefined,
          syncedConnectionUpdatedDate: undefined,
        },
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
  const handleNavigateToCreateView: NavigateToCreateView = useCallback((connectionType, plaidCategory) => {
    setActiveConnectionState({ view: 'create', type: connectionType, plaidCategory });
    trackEvent('[Connections].start-create', { type: connectionType });
  }, []);
  const handleNavigateToCreatePotentialView: NavigateToCreatePotentialView = useCallback((connectionType) => {
    setActiveConnectionState({ view: 'create-potential', type: connectionType });
    trackEvent('[Connections].click-potential-connection', { type: connectionType });
  }, []);
  const handleNavigateToEditView: NavigateToView = useCallback(({ connectionType, connectionUuid }) => {
    setActiveConnectionState({ view: 'edit', uuid: connectionUuid, type: connectionType });
  }, []);
  const handleNavigateToNewView = useCallback(() => {
    setActiveConnectionState({ view: 'new' });
  }, []);

  const connectionsBreadcrumb = useMemo(
    () => ({ label: 'Connections', onClick: handleNavigateToListView }),
    [handleNavigateToListView]
  );
  const connectionsNewBreadcrumb = useMemo(
    () => ({ label: 'New', onClick: handleNavigateToNewView }),
    [handleNavigateToNewView]
  );

  return (
    <ConnectionsProvider sshPublicKey={sshPublicKey}>
      <TooltipProvider>
        <div className={hideSidebar ? '' : 'grid-cols-12 gap-12 md:grid'}>
          <div className={hideSidebar ? '' : 'col-span-8'}>
            {activeConnectionState.view === 'edit' ? (
              <>
                <ConnectionBreadcrumbs
                  breadcrumbs={[
                    connectionsBreadcrumb,
                    {
                      label: `Edit`,
                      onClick: handleNavigateToListView,
                    },
                  ]}
                  Logo={connectionsByType[activeConnectionState.type].Logo}
                />
                <ConnectionFormEdit
                  connectionUuid={activeConnectionState.uuid}
                  connectionType={activeConnectionState.type}
                  handleNavigateToListView={handleNavigateToListView}
                  teamUuid={teamUuid}
                />
              </>
            ) : activeConnectionState.view === 'details' ? (
              <>
                <ConnectionBreadcrumbs
                  breadcrumbs={[
                    connectionsBreadcrumb,
                    {
                      label: 'Browse',
                      onClick: handleNavigateToListView,
                    },
                  ]}
                  Logo={connectionsByType[activeConnectionState.type].Logo}
                />
                <ConnectionDetails
                  connectionUuid={activeConnectionState.uuid}
                  connectionType={activeConnectionState.type}
                  teamUuid={teamUuid}
                />
              </>
            ) : activeConnectionState.view === 'new' ? (
              <>
                <ConnectionBreadcrumbs
                  breadcrumbs={[connectionsBreadcrumb, { label: `New`, onClick: handleNavigateToListView }]}
                />
                <ConnectionsNew
                  handleNavigateToCreateView={handleNavigateToCreateView}
                  handleNavigateToCreatePotentialView={handleNavigateToCreatePotentialView}
                />
              </>
            ) : activeConnectionState.view === 'create' ? (
              <>
                <ConnectionBreadcrumbs
                  breadcrumbs={[
                    connectionsBreadcrumb,
                    connectionsNewBreadcrumb,
                    { label: connectionsByType[activeConnectionState.type].name },
                  ]}
                  Logo={connectionsByType[activeConnectionState.type].Logo}
                />
                <ConnectionFormCreate
                  teamUuid={teamUuid}
                  type={activeConnectionState.type}
                  plaidCategory={activeConnectionState.plaidCategory}
                  handleNavigateToListView={handleNavigateToListView}
                  handleNavigateToNewView={handleNavigateToNewView}
                  onConnectionCreated={onConnectionCreated}
                />
              </>
            ) : activeConnectionState.view === 'create-potential' ? (
              <>
                <ConnectionBreadcrumbs
                  breadcrumbs={[
                    connectionsBreadcrumb,
                    connectionsNewBreadcrumb,
                    { label: potentialConnectionsByType[activeConnectionState.type].name },
                  ]}
                  Logo={potentialConnectionsByType[activeConnectionState.type].Logo}
                />
                <ConnectionsPotential
                  handleNavigateToNewView={handleNavigateToNewView}
                  connectionType={activeConnectionState.type}
                />
              </>
            ) : (
              <ConnectionsList
                connections={connections}
                teamUuid={teamUuid}
                connectionsAreLoading={connectionsAreLoading}
                handleNavigateToNewView={handleNavigateToNewView}
                handleNavigateToEditView={handleNavigateToEditView}
                handleShowConnectionDemo={handleShowConnectionDemo}
                onConnectionSelected={onConnectionSelected}
              />
            )}
          </div>
          {!hideSidebar && (
            <div className="col-span-4 mt-12 md:mt-0">
              <ConnectionsSidebar
                staticIps={staticIps}
                connectionType={
                  activeConnectionState.view === 'create' || activeConnectionState.view === 'edit'
                    ? activeConnectionState.type
                    : undefined
                }
                showIps={activeConnectionState.view === 'details'}
              />
            </div>
          )}
        </div>
      </TooltipProvider>
    </ConnectionsProvider>
  );
};

const ConnectionBreadcrumbs = memo(
  ({
    breadcrumbs,
    Logo,
  }: {
    breadcrumbs: Array<{ label: string; onClick?: () => void }>;
    Logo?: React.ComponentType;
  }) => {
    return (
      <div className="flex items-center gap-2 pb-5 pt-0.5">
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map(({ label, onClick }, i) =>
              i === breadcrumbs.length - 1 ? (
                <BreadcrumbPage key={label + i}>{label}</BreadcrumbPage>
              ) : (
                <Fragment key={label + i}>
                  <BreadcrumbItem>
                    <BreadcrumbLink onClick={onClick} className="cursor-pointer">
                      {label}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </Fragment>
              )
            )}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto h-8">{Logo && <Logo />}</div>
      </div>
    );
  }
);

function getInitialConnectionStateFromProps({
  initialView,
  initialConnectionType,
  initialConnectionUuid,
  searchParams,
}: {
  initialView?: 'new' | 'list';
  initialConnectionType?: ConnectionType;
  initialConnectionUuid?: string;
  searchParams: URLSearchParams;
}): ConnectionState {
  // First check props
  if (initialView === 'new') {
    return { view: 'new' };
  }

  if (initialConnectionType && isDatabaseConnection(initialConnectionType)) {
    if (initialConnectionUuid) {
      return { view: 'edit', uuid: initialConnectionUuid, type: initialConnectionType };
    }
    return { view: 'create', type: initialConnectionType };
  }

  // Fall back to search params
  const view = searchParams.get('view');
  if (view === 'new') {
    return { view: 'new' };
  }

  const type = searchParams.get('initial-connection-type');
  const uuid = searchParams.get('initial-connection-uuid');
  if (type && isDatabaseConnection(type)) {
    if (uuid) {
      return { view: 'edit', uuid, type: type as ConnectionType };
    }
    return { view: 'create', type: type as ConnectionType };
  }

  return { view: 'list' };
}
