import {
  getToggleShowConnectionDemoAction,
  type CreateConnectionAction,
  type DeleteConnectionAction,
  type ToggleShowConnectionDemoAction,
  type UpdateConnectionAction,
} from '@/routes/api.connections';
import { connectionClient } from '@/shared/api/connectionClient';
import { ConnectionDetails } from '@/shared/components/connections/ConnectionDetails';
import { ConnectionFormCreate, ConnectionFormEdit } from '@/shared/components/connections/ConnectionForm';
import {
  potentialConnectionsByType,
  type PotentialConnectionType,
} from '@/shared/components/connections/connectionsByType';
import { ConnectionsList } from '@/shared/components/connections/ConnectionsList';
import { ConnectionsNew } from '@/shared/components/connections/ConnectionsNew';
import { ConnectionsPotential } from '@/shared/components/connections/ConnectionsPotential';
import { ConnectionsSidebar } from '@/shared/components/connections/ConnectionsSidebar';
import { ArrowUpwardIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { newNewFileFromStateConnection } from '@/shared/hooks/useNewFileFromState';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/shadcn/ui/tabs';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import type { ConnectionList, ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { Fragment, memo, useCallback, useMemo, useState } from 'react';
import { Link, useFetchers, useSearchParams, useSubmit } from 'react-router';

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
  | { view: 'list' }
  | { view: 'chat'; type: ConnectionType; uuid: string };

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
  const handleNavigateToChatView: NavigateToView = useCallback(({ connectionType, connectionUuid }) => {
    setActiveConnectionState({ view: 'chat', type: connectionType, uuid: connectionUuid });
  }, []);
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
  const newFileTo = newNewFileFromStateConnection({
    query: '',
    isPrivate: false,
    teamUuid,
    // @ts-expect-error
    connectionType: activeConnectionState.type,
    // @ts-expect-error
    connectionUuid: activeConnectionState.uuid,
  });

  return (
    <div className={'h-full grid-cols-12 overflow-hidden md:grid'}>
      <div className="col-span-3 overflow-auto border-r border-border px-3 pt-2">
        <div className="flex h-10 items-center gap-2 text-sm">
          <span className={cn('flex-shrink-0 font-medium')}>Connections</span>
        </div>
        {activeConnectionState.view === 'create-potential' ? (
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
            handleNavigateToListView={handleNavigateToListView}
            activeConnection={
              activeConnectionState.view === 'edit' || activeConnectionState.view === 'details'
                ? activeConnectionState.uuid
                : activeConnectionState.view === 'new' || activeConnectionState.view === 'create'
                  ? 'new'
                  : ''
            }
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
      {(activeConnectionState.view === 'edit' ||
        activeConnectionState.view === 'details' ||
        activeConnectionState.view === 'chat') && (
        <div className="col-span-9 h-full overflow-hidden">
          <Tabs
            className="h-full"
            value={activeConnectionState.view}
            onValueChange={(value) => {
              if (value === 'chat') {
                handleNavigateToChatView({
                  connectionType: activeConnectionState.type,
                  connectionUuid: activeConnectionState.uuid,
                });
              } else if (value === 'details') {
                handleNavigateToDetailsView({
                  connectionType: activeConnectionState.type,
                  connectionUuid: activeConnectionState.uuid,
                });
              } else if (value === 'edit') {
                handleNavigateToEditView({
                  connectionType: activeConnectionState.type,
                  connectionUuid: activeConnectionState.uuid,
                });
              }
            }}
          >
            <div className="flex flex-row justify-between border-b border-border px-3 pt-2">
              <TabsList>
                <TabsTrigger value="details">Schema</TabsTrigger>
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="chat">Chat</TabsTrigger>
              </TabsList>

              <Button className="-mt-1" asChild>
                <Link to={newFileTo}>New file from connection</Link>
              </Button>
            </div>

            <TabsContent
              value="details"
              className={cn('mt-0 flex flex-row', activeConnectionState.view === 'details' && 'h-full')}
            >
              <div className="w-1/3 border-r border-border">
                <ConnectionDetails
                  connectionUuid={activeConnectionState.uuid}
                  connectionType={activeConnectionState.type}
                  teamUuid={teamUuid}
                  onTableQueryAction={(query) => {
                    const jsonData = generateData();
                    setData(jsonData);

                    connectionClient
                      .query(query, { type: activeConnectionState.type, uuid: activeConnectionState.uuid, teamUuid })
                      .then((json) => {
                        console.log(json);
                      });
                    console.log(jsonData);
                  }}
                />
              </div>

              <div className="w-2/3 overflow-auto">
                <table className="table table-auto text-sm">
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
            </TabsContent>
            <TabsContent value="edit">
              <div className="grid grid-cols-12 gap-8">
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
            </TabsContent>
            <TabsContent
              value="chat"
              className={cn(
                'mt-0 flex flex-col items-center justify-center',
                activeConnectionState.view === 'chat' && 'h-full'
              )}
            >
              <div className="relative w-full max-w-lg">
                <div className="absolute left-3 top-2 flex items-center gap-1 rounded-md border border-border px-1 py-0.5 text-xs">
                  <LanguageIcon language={activeConnectionState.type} className="h-4 w-4" />{' '}
                  {activeConnectionState.type}
                </div>
                <Textarea
                  className="h-40 w-full max-w-lg bg-accent pt-10 shadow-sm"
                  autoFocus
                  placeholder="Ask a question about your data..."
                />
                <Button size="icon" className="absolute bottom-4 right-2 rounded-full">
                  <ArrowUpwardIcon />
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {activeConnectionState.view === 'new' || activeConnectionState.view === 'create' ? (
        <div className="col-span-3 h-full overflow-auto border-r border-border px-3 pt-2">
          <ConnectionsNew
            handleNavigateToCreateView={handleNavigateToCreateView}
            handleNavigateToCreatePotentialView={handleNavigateToCreatePotentialView}
          />
        </div>
      ) : null}

      {activeConnectionState.view === 'create' && (
        <div className="col-span-6 px-3 pt-2">
          <ConnectionFormCreate
            teamUuid={teamUuid}
            type={activeConnectionState.type}
            handleNavigateToListView={handleNavigateToListView}
            handleNavigateToNewView={handleNavigateToNewView}
          />
        </div>
      )}
    </div>
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
