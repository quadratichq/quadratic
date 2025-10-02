import { ConnectionPreview } from '@/dashboard/connections/ConnectionPreview';
import { ConnectionPreviewError } from '@/dashboard/connections/ConnectionPreviewError';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { getDeleteConnectionAction } from '@/routes/api.connections';
import { useConfirmDialog } from '@/shared/components/ConfirmProvider';
import { ConnectionFormEdit } from '@/shared/components/connections/ConnectionForm';
import { ConnectionsSidebar } from '@/shared/components/connections/ConnectionsSidebar';
import { EmptyState } from '@/shared/components/EmptyState';
import { RefreshIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { useConnectionSchemaBrowser } from '@/shared/hooks/useConnectionSchemaBrowser';
import { Button } from '@/shared/shadcn/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/shadcn/ui/tabs';
import { Textarea } from '@/shared/shadcn/ui/textarea';
import { cn } from '@/shared/shadcn/utils';
import { QuestionMarkCircledIcon } from '@radix-ui/react-icons';
import { useEffect, useState } from 'react';
import { Link, useLoaderData, useNavigate, useSubmit, type LoaderFunctionArgs } from 'react-router';
// import { useLoaderData } from 'react-router';

type ActiveTab = 'preview' | 'edit';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { teamUuid, connectionUuid } = params;
  if (!connectionUuid || !teamUuid) throw new Error('No connection UUID provided');

  return { connectionUuid, teamUuid };
};

export const Component = () => {
  const { connectionUuid, teamUuid } = useLoaderData<typeof loader>();
  const [activeTab, setActiveTab] = useState<ActiveTab>('preview');

  const {
    activeTeam: { connections },
  } = useDashboardRouteLoaderData();
  const connectionType = connections.find((connection) => connection.uuid === connectionUuid)?.type || 'MYSQL';

  const { data, isLoading, reloadSchema } = useConnectionSchemaBrowser({
    type: connectionType,
    uuid: connectionUuid,
    teamUuid,
  });

  const confirmFn = useConfirmDialog('deleteConnection', undefined);
  const submit = useSubmit();
  const navigate = useNavigate();

  useEffect(() => {
    setActiveTab('preview');
  }, [connectionUuid]);

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ActiveTab)} className={cn('h-full')}>
      <TabsList className="h-12 w-full justify-start border-b border-border px-3">
        <div className="mr-auto flex hidden items-center gap-2">
          <LanguageIcon language={data?.type} />
          <p className="text-lg font-medium text-foreground">{data?.name}</p>
        </div>
        <TabsTrigger value="preview" className="h-12">
          Preview
        </TabsTrigger>
        <TabsTrigger value="edit" className="h-12">
          Edit
        </TabsTrigger>
        <TabsTrigger value="chat" className="h-12">
          Chat
        </TabsTrigger>
        {activeTab === 'preview' && false && (
          <div className="ml-auto mr-2 flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={reloadSchema}>
              <RefreshIcon className={cn(isLoading && 'animate-spin text-primary')} />
            </Button>
            <Button className="" asChild>
              <Link to={'/files/create'} reloadDocument>
                New file from data
              </Link>
            </Button>
          </div>
        )}
      </TabsList>
      <TabsContent value="preview" className={cn('mt-0 h-full', isLoading && 'pointer-events-none opacity-50')}>
        {data ? (
          <ConnectionPreview teamUuid={teamUuid} connectionUuid={connectionUuid} connectionType={connectionType} />
        ) : data === null ? (
          <ConnectionPreviewError
            reloadSchema={reloadSchema}
            teamUuid={teamUuid}
            uuid={connectionUuid}
            type={connectionType}
            handleNavigateToEdit={() => setActiveTab('edit')}
          />
        ) : null}
      </TabsContent>
      <TabsContent value="edit" className="mt-0 h-full overflow-y-auto">
        {connectionUuid === '00000000-0000-0000-0000-000000000000' ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              title="Connection not editable"
              description={
                'This is a demo connection managed by the Quadratic team. If you don’t want to see it in your team, delete it.'
              }
              actions={
                <Button
                  type="button"
                  variant="outline-destructive"
                  className="flex-shrink-0"
                  onClick={async () => {
                    if (await confirmFn()) {
                      // TODO: handle new a new [Connections] events for ones from the dashboard vs. in-app
                      // trackEvent('[Connections].delete', { type: connectionType });
                      const { json, options } = getDeleteConnectionAction(connectionUuid, teamUuid);
                      submit(json, {
                        ...options,
                        navigate: false,
                      });
                      navigate('../');
                    }
                  }}
                >
                  Delete
                </Button>
              }
              Icon={QuestionMarkCircledIcon}
            />
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-8 p-3">
            <div className="col-span-8">
              <ConnectionFormEdit
                connectionUuid={connectionUuid}
                connectionType={connectionType}
                handleNavigateToListView={() => setActiveTab('preview')}
                teamUuid={teamUuid}
              />
            </div>
            <div className="col-span-4">
              <ConnectionsSidebar staticIps={['192.168.0.1']} sshPublicKey={'foobar'} />
            </div>
          </div>
        )}
      </TabsContent>
      <TabsContent value="chat" className="mt-0 flex h-full justify-center overflow-y-auto">
        <div className="mt-4 flex w-full max-w-lg flex-col gap-2">
          <Textarea
            className="min-h-40 w-full max-w-lg bg-accent py-3 shadow-sm"
            autoFocus
            placeholder="Ask a question about your data..."
          />
          <Button className="ml-auto">New file with chat</Button>
        </div>
      </TabsContent>
    </Tabs>
  );
};
