import { ConnectionPreview } from '@/dashboard/connections/ConnectionPreview';
import { ConnectionPreviewError } from '@/dashboard/connections/ConnectionPreviewError';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { RefreshIcon, SpinnerIcon } from '@/shared/components/Icons';
import { useConnectionSchemaBrowser } from '@/shared/hooks/useConnectionSchemaBrowser';
import { Button } from '@/shared/shadcn/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/shadcn/ui/tabs';
import { cn } from '@/shared/shadcn/utils';
import { useState } from 'react';
import { useLoaderData, useNavigation, type LoaderFunctionArgs } from 'react-router';
// import { useLoaderData } from 'react-router';

type ActiveTab = 'preview' | 'edit';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { teamUuid, connectionUuid } = params;
  if (!connectionUuid || !teamUuid) throw new Error('No connection UUID provided');

  return { connectionUuid, teamUuid };
};

export const Component = () => {
  const { connectionUuid, teamUuid } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
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

  console.log(navigation);

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ActiveTab)} className="h-full">
      <TabsList className="h-12 w-full justify-start border-b border-border">
        <TabsTrigger value="preview" className="h-12">
          Preview
        </TabsTrigger>
        <TabsTrigger value="edit" className="h-12">
          Edit
        </TabsTrigger>

        {activeTab === 'preview' && (
          <div className="ml-auto mr-2 flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={reloadSchema}>
              <RefreshIcon className={cn(isLoading && 'animate-spin')} />
            </Button>
            <Button className="">New file from data</Button>
          </div>
        )}
      </TabsList>
      <TabsContent value="preview" className="mt-0 h-full">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <SpinnerIcon />
          </div>
        ) : data === null ? (
          <ConnectionPreviewError
            reloadSchema={reloadSchema}
            teamUuid={teamUuid}
            uuid={connectionUuid}
            type={connectionType}
            handleNavigateToEdit={() => setActiveTab('edit')}
          />
        ) : (
          <ConnectionPreview teamUuid={teamUuid} connectionUuid={connectionUuid} connectionType={connectionType} />
        )}
      </TabsContent>
      <TabsContent value="edit">Change your password here.</TabsContent>
    </Tabs>
  );
};
