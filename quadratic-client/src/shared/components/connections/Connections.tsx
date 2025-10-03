import {
  getToggleShowConnectionDemoAction,
  type CreateConnectionAction,
  type DeleteConnectionAction,
  type ToggleShowConnectionDemoAction,
  type UpdateConnectionAction,
} from '@/routes/api.connections';
import { ConnectionDetails } from '@/shared/components/connections/ConnectionDetails';
import { ConnectionFormCreate, ConnectionFormEdit } from '@/shared/components/connections/ConnectionForm';
import { type PotentialConnectionType } from '@/shared/components/connections/connectionsByType';
import { ConnectionsList } from '@/shared/components/connections/ConnectionsList';
import { ConnectionsNew } from '@/shared/components/connections/ConnectionsNew';
import { ConnectionsPotential } from '@/shared/components/connections/ConnectionsPotential';
import { ConnectionsSidebar } from '@/shared/components/connections/ConnectionsSidebar';
import { CloseIcon } from '@/shared/components/Icons';
import { useUpdateQueryStringValueWithoutNavigation } from '@/shared/hooks/useUpdateQueryStringValueWithoutNavigation';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/shadcn/ui/breadcrumb';
import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import type { ConnectionList, ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { Fragment, memo, useCallback, useMemo, useState } from 'react';
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
export type NavigateToCreatePotentialView = (type: PotentialConnectionType) => void;

type ConnectionState =
  | { view: 'edit'; uuid: string; type: ConnectionType }
  | { view: 'details'; uuid: string; type: ConnectionType }
  | { view: 'new' }
  | { view: 'create'; type: ConnectionType }
  | { view: 'create-potential'; type: PotentialConnectionType }
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
  const handleNavigateToCreatePotentialView: NavigateToCreatePotentialView = useCallback((connectionType) => {
    setActiveConnectionState({ view: 'create-potential', type: connectionType });
    trackEvent('[Connections].click-potential-connection', { type: connectionType });
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

  const connectionsBreadcrumb = useMemo(
    () => ({ label: 'Connections', onClick: handleNavigateToListView }),
    [handleNavigateToListView]
  );
  const connectionsNewBreadcrumb = useMemo(
    () => ({ label: 'New', onClick: handleNavigateToNewView }),
    [handleNavigateToNewView]
  );

  const [data, setData] = useState<any>(generateData());

  const breadcrumbs = useMemo(() => {
    if (activeConnectionState.view === 'new') {
      return <ConnectionBreadcrumbs breadcrumbs={[connectionsBreadcrumb, connectionsNewBreadcrumb]} />;
    }
    if (activeConnectionState.view === 'create') {
      return (
        <ConnectionBreadcrumbs
          breadcrumbs={[connectionsBreadcrumb, connectionsNewBreadcrumb, { label: activeConnectionState.type }]}
        />
      );
    }
    if (activeConnectionState.view === 'details') {
      return (
        <ConnectionBreadcrumbs
          breadcrumbs={[
            connectionsBreadcrumb,
            {
              label:
                connections.find((connection) => connection.uuid === activeConnectionState.uuid)?.name || 'Unknown',
            },
          ]}
        />
      );
    }
    if (activeConnectionState.view === 'edit') {
      return (
        <ConnectionBreadcrumbs
          breadcrumbs={[
            connectionsBreadcrumb,
            {
              label:
                connections.find((connection) => connection.uuid === activeConnectionState.uuid)?.name || 'Unknown',
              onClick: () =>
                handleNavigateToDetailsView({
                  connectionType: activeConnectionState.type,
                  connectionUuid: activeConnectionState.uuid,
                }),
            },
            { label: 'Edit' },
          ]}
        />
      );
    }
    return <ConnectionBreadcrumbs breadcrumbs={[connectionsBreadcrumb]} />;
  }, [
    activeConnectionState,
    connections,
    connectionsBreadcrumb,
    connectionsNewBreadcrumb,

    handleNavigateToDetailsView,
  ]);

  return (
    <div className="flex flex-col gap-0">
      <div className="flex h-12 w-full items-center gap-2 border-b border-border px-3">
        {breadcrumbs}
        <div className="ml-auto flex flex-row gap-2">
          {activeConnectionState.view === 'details' && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  handleNavigateToEditView({
                    connectionType: activeConnectionState?.type,
                    connectionUuid: activeConnectionState?.uuid,
                  });
                }}
              >
                Edit connection
              </Button>
              <Button className="">Add data to sheet</Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              console.log('TODO: handle close');
            }}
          >
            <CloseIcon />
          </Button>
        </div>
      </div>

      <div className={'h-full grid-cols-12 overflow-hidden md:grid'}>
        {activeConnectionState.view === 'create-potential' && (
          <ConnectionsPotential
            handleNavigateToNewView={handleNavigateToNewView}
            connectionType={activeConnectionState.type}
          />
        )}
        {activeConnectionState.view === 'list' && (
          <div className="col-span-6 overflow-auto px-3 pt-2">
            <ConnectionsList
              handleNavigateToListView={handleNavigateToListView}
              activeConnection={'list'}
              connections={connections}
              connectionsAreLoading={connectionsAreLoading}
              handleNavigateToNewView={handleNavigateToNewView}
              handleNavigateToCreateView={handleNavigateToCreateView}
              handleNavigateToEditView={handleNavigateToEditView}
              handleNavigateToDetailsView={handleNavigateToDetailsView}
              handleShowConnectionDemo={handleShowConnectionDemo}
            />
          </div>
        )}

        {activeConnectionState.view === 'edit' && (
          <div className="col-span-12 h-full overflow-hidden">
            <div className="col-span-9 px-3">
              <ConnectionFormEdit
                connectionUuid={activeConnectionState.uuid}
                connectionType={activeConnectionState.type}
                handleNavigateToListView={handleNavigateToListView}
                teamUuid={teamUuid}
              />
            </div>
            <div className="col-span-3 pr-3 pt-3">
              <ConnectionsSidebar staticIps={staticIps} sshPublicKey={sshPublicKey} />
            </div>
          </div>
        )}

        {activeConnectionState.view === 'details' && (
          <>
            <div className="col-span-3 border-r border-border">
              <ConnectionDetails
                connectionUuid={activeConnectionState.uuid}
                connectionType={activeConnectionState.type}
                teamUuid={teamUuid}
                onTableQueryAction={(query) => {
                  const jsonData = generateData();
                  setData(jsonData);

                  // connectionClient
                  //   .query(query, { type: activeConnectionState.type, uuid: activeConnectionState.uuid, teamUuid })
                  //   .then((json) => {
                  //     console.log(json);
                  //   });
                  // console.log(jsonData);
                }}
              />
            </div>
            <div className="col-span-9 overflow-auto">
              <table className="table w-full table-auto text-sm">
                <thead>
                  <tr className="sticky top-0 border-b border-border bg-white">
                    {Object.keys(data[0]).map((key) => (
                      <th className="sticky top-0 border-b border-border bg-white px-2 text-left">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row: any) => (
                    <tr>
                      {Object.keys(row).map((key) => (
                        <td className="whitespace-nowrap px-2">{row[key]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeConnectionState.view === 'new' ? (
          <div className="col-span-9 h-full overflow-auto border-r border-border px-3 pt-2">
            <ConnectionsNew
              handleNavigateToCreateView={handleNavigateToCreateView}
              handleNavigateToCreatePotentialView={handleNavigateToCreatePotentialView}
            />
          </div>
        ) : null}

        {activeConnectionState.view === 'create' && (
          <div className="col-span-9 px-3 pt-2">
            <ConnectionFormCreate
              teamUuid={teamUuid}
              type={activeConnectionState.type}
              handleNavigateToListView={handleNavigateToListView}
              handleNavigateToNewView={handleNavigateToNewView}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const ConnectionBreadcrumbs = memo(
  ({ breadcrumbs }: { breadcrumbs: Array<{ label: string; onClick?: () => void }> }) => {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map(({ label, onClick }, i) =>
            i === breadcrumbs.length - 1 ? (
              <BreadcrumbPage className="font-medium" key={label + i}>
                {label}
              </BreadcrumbPage>
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
    );
  }
);

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

const firstNames = ['Alice', 'Bob', 'Carol', 'David', 'Eve', 'Frank', 'Grace'];
const lastNames = ['Smith', 'Johnson', 'Lee', 'Patel', 'Garcia', 'Müller', 'Brown'];
const cities = ['New York', 'London', 'Berlin', 'Tokyo', 'Sydney', 'Toronto', 'Paris'];
const statuses = ['active', 'inactive', 'pending'];
const countries = ['United States', 'Canada', 'United Kingdom', 'Australia', 'France', 'Germany', 'Italy'];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomDate(start: Date, end: Date) {
  const ts = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(ts).toISOString().split('T')[0];
}
function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateData(rows = 100) {
  const baseKeys = ['id', 'name', 'email', 'age', 'city', 'signupDate', 'status', 'address'] as const;
  const orderedKeys = shuffle([...baseKeys]); // new column order each run

  const data: Record<(typeof baseKeys)[number], unknown>[] = [];
  for (let i = 0; i < rows; i++) {
    const first = randomItem(firstNames);
    const last = randomItem(lastNames);
    const base = {
      id: i + 1,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
      age: Math.floor(Math.random() * 40) + 20,
      city: randomItem(cities),
      signupDate: randomDate(new Date(2020, 0, 1), new Date()),
      status: randomItem(statuses),
      address: `${randomItem(cities)}, ${randomItem(countries)}`,
    };

    // Insert properties in the same shuffled order for every row
    const row: any = {};
    for (const k of orderedKeys) row[k] = base[k];
    data.push(row);
  }
  return data;
}
