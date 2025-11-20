import { requireAuth } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { DatabaseIcon, FileIcon, PDFIcon, SearchIcon, StarShineIcon } from '@/shared/components/Icons';
import { QuadraticLogo } from '@/shared/components/QuadraticLogo';
import { ROUTES } from '@/shared/constants/routes';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Card, CardDescription, CardHeader, CardTitle } from '@/shared/shadcn/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, useLoaderData, useNavigate } from 'react-router';

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

const FILE_TYPES = ['.csv', '.xlsx', '.parquet'];

export const Component = () => {
  useRemoveInitialLoadingUI();
  const { connections } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const dataSourceOptions = [
    {
      id: 'file',
      title: 'File',
      description: `Upload a file with your data`,
      icon: FileIcon,
      badge: FILE_TYPES.join(', '),
      gradient: 'from-blue-500 to-cyan-600',
      featured: false,
      action: () => {
        navigate(ROUTES.FILES_CREATE_AI_FILE);
      },
    },
    {
      id: 'prompt',
      title: 'Generate from prompt',
      description: 'Create a spreadsheet starting from a prompt',
      icon: StarShineIcon,
      gradient: 'from-purple-500 to-pink-600',
      featured: true,
      recommended: true,
      action: () => {
        navigate(ROUTES.FILES_CREATE_AI_PROMPT);
      },
    },
    {
      id: 'pdf',
      title: 'PDF',
      description: 'Extract structured data from PDF documents',
      icon: PDFIcon,
      gradient: 'from-red-500 to-orange-600',
      featured: false,
      action: () => {
        navigate(ROUTES.FILES_CREATE_AI_PDF);
      },
    },
    {
      id: 'connection',
      title: 'Connection',
      description:
        connections.length > 0
          ? `Use one of your ${connections.length} connection${connections.length !== 1 ? 's' : ''}`
          : 'Connect to a database',
      icon: DatabaseIcon,
      badge: connections.length > 0 ? `${connections.length} available` : undefined,
      gradient: 'from-green-500 to-emerald-600',
      featured: false,
      action: () => {
        navigate(ROUTES.FILES_CREATE_AI_CONNECTION);
      },
    },
    {
      id: 'web-research',
      title: 'Web Research',
      description: 'Let AI search the web and gather data',
      icon: SearchIcon,
      gradient: 'from-indigo-500 to-blue-600',
      featured: false,
      action: () => {
        navigate(ROUTES.FILES_CREATE_AI_WEB);
      },
    },
  ];

  return (
    <div className="relative flex h-full flex-col bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-950/20 dark:via-blue-950/20 dark:to-indigo-950/20">
      {/* Logo in top left */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/"
              className="absolute left-6 top-6 z-10 flex h-12 w-12 items-center justify-center rounded-lg border-2 border-border bg-background text-foreground shadow-sm transition-all hover:border-primary hover:shadow-md"
            >
              <QuadraticLogo />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">Back to Dashboard</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Main content area */}
      <main className="flex flex-1 justify-center overflow-auto p-6 pt-16">
        <div className="w-full max-w-5xl">
          <div className="mb-6 text-center">
            <h1 className="mb-2 text-3xl font-bold">Start with AI</h1>
            <p className="text-base text-muted-foreground">What data would you like to start with?</p>
          </div>

          {/* First row - 3 items with Generate in the middle */}
          <div className="mb-4 grid gap-4 md:grid-cols-3">
            {dataSourceOptions.slice(0, 3).map((option) => (
              <Card
                key={option.id}
                className="group cursor-pointer overflow-hidden transition-all hover:border-primary hover:shadow-lg"
                onClick={option.action}
              >
                <div
                  className={`relative flex items-center justify-center bg-gradient-to-br ${option.gradient} ${
                    option.featured ? 'h-36' : 'h-28'
                  }`}
                >
                  {option.recommended && (
                    <span className="absolute right-3 top-3 rounded-md bg-green-500 px-2 py-1 text-xs font-semibold uppercase text-white">
                      Recommended
                    </span>
                  )}
                  <option.icon className="text-white" size={option.featured ? '2xl' : 'lg'} />
                </div>
                <CardHeader>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <CardTitle className={`group-hover:text-primary ${option.featured ? 'text-lg' : 'text-base'}`}>
                      {option.title}
                    </CardTitle>
                    {option.badge && (
                      <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                        {option.badge}
                      </span>
                    )}
                  </div>
                  <CardDescription className="text-xs">{option.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          {/* Second row - 2 items centered */}
          <div className="flex justify-center gap-4">
            {dataSourceOptions.slice(3).map((option) => (
              <Card
                key={option.id}
                className="group w-full max-w-[calc(33.333%-0.67rem)] cursor-pointer overflow-hidden transition-all hover:border-primary hover:shadow-lg"
                onClick={option.action}
              >
                <div className={`flex h-28 items-center justify-center bg-gradient-to-br ${option.gradient}`}>
                  <option.icon className="text-white" size="lg" />
                </div>
                <CardHeader>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base group-hover:text-primary">{option.title}</CardTitle>
                    {option.badge && (
                      <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                        {option.badge}
                      </span>
                    )}
                  </div>
                  <CardDescription className="text-xs">{option.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};
