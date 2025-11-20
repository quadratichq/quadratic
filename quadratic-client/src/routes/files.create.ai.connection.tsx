import { requireAuth } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { DatabaseIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { ROUTES } from '@/shared/constants/routes';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Button } from '@/shared/shadcn/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/shared/shadcn/ui/card';
import { ChevronLeftIcon, PlusIcon } from '@radix-ui/react-icons';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, useLoaderData } from 'react-router';

export const loader = async (loaderArgs: LoaderFunctionArgs) => {
  // Require authentication to access this page
  const { activeTeamUuid } = await requireAuth(loaderArgs.request);

  // Fetch team data to get connections
  const teamData = await apiClient.teams.get(activeTeamUuid);

  return {
    connections: teamData.connections,
    teamUuid: teamData.team.uuid,
  };
};

export const Component = () => {
  useRemoveInitialLoadingUI();
  const { connections, teamUuid } = useLoaderData<typeof loader>();

  return (
    <div className="relative flex h-full flex-col bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-950/20 dark:via-blue-950/20 dark:to-indigo-950/20">
      {/* Back button in top left */}
      <Link
        to={ROUTES.FILES_CREATE_AI}
        className="absolute left-6 top-6 z-10 flex h-12 w-12 items-center justify-center rounded-lg border-2 border-border bg-background text-foreground shadow-sm transition-all hover:border-primary hover:shadow-md"
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </Link>

      {/* Main content area */}
      <main className="flex flex-1 justify-center overflow-auto p-6 pt-16">
        <div className="w-full max-w-3xl">
          <div className="mb-8 text-center">
            <h1 className="mb-3 text-3xl font-bold">Choose a Connection</h1>
            <p className="text-base text-muted-foreground">
              {connections.length > 0
                ? 'Select a connection to start creating your spreadsheet'
                : 'Create a connection to get started'}
            </p>
          </div>

          {connections.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {connections.map((connection) => (
                <Card
                  key={connection.uuid}
                  className="group cursor-pointer transition-all hover:border-primary hover:shadow-md"
                  onClick={() => {
                    // TODO: Implement connection selection and file creation
                    console.log('Selected connection:', connection);
                  }}
                >
                  <CardHeader>
                    <div className="mb-2 flex items-center gap-3">
                      <LanguageIcon language={connection.type} />
                      <div className="min-w-0 flex-1">
                        <CardTitle className="truncate text-base group-hover:text-primary">{connection.name}</CardTitle>
                        <CardDescription className="text-xs">{connection.type}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center">
              <DatabaseIcon className="mx-auto mb-4 text-muted-foreground" size="2xl" />
              <p className="mb-6 text-muted-foreground">No connections yet</p>
              <Button asChild>
                <Link to={ROUTES.TEAM_CONNECTIONS(teamUuid)} className="inline-flex items-center gap-2">
                  <PlusIcon className="h-4 w-4" />
                  Add a Connection
                </Link>
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
