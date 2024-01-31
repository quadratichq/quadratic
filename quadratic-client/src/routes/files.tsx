import { Type } from '@/components/Type';
import { ROUTES } from '@/constants/routes';
import { DOCUMENTATION_URL } from '@/constants/urls';
import { Button } from '@/shadcn/ui/button';
import { cn } from '@/shadcn/utils';
import { Box, useTheme } from '@mui/material';
import { ExclamationTriangleIcon, ExternalLinkIcon, FileIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { Link, LoaderFunctionArgs, useLoaderData, useRouteError } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { Empty } from '../components/Empty';
import CreateFileButton from '../dashboard/components/CreateFileButton';
import { DashboardHeader } from '../dashboard/components/DashboardHeader';
import { FilesList } from '../dashboard/components/FilesList';
import { debugShowUILogs } from '../debugFlags';

export type Loader = ApiTypes['/v0/files.GET.response'];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const data = await apiClient.files.list();
  return data;
};

export const Component = () => {
  const files = useLoaderData() as Loader;

  return (
    <>
      <DashboardHeader title="My files" actions={<CreateFileButton />} />
      <FilesList
        isEditable={true}
        files={files}
        emptyState={
          <Empty
            className="max-w-xl"
            title="No files"
            description={<>You don’t have any files, but you can create one below.</>}
            Icon={FileIcon}
            actions={
              <div>
                {[
                  {
                    title: 'Learn the basics',
                    description: 'With an instructional walk-through',
                    link: (
                      <Link
                        to={ROUTES.CREATE_EXAMPLE_FILE('default.grid')}
                        reloadDocument
                        onClick={() => {
                          mixpanel.track('[FilesEmptyState].clickOpenStarterFile');
                        }}
                      >
                        Open starter file
                      </Link>
                    ),
                    className: 'border border-primary bg-yellow-5000',
                  },
                  {
                    title: 'Get started',
                    description: 'With a fresh new file',
                    link: (
                      <Link
                        to={ROUTES.CREATE_FILE}
                        reloadDocument
                        onClick={() => {
                          mixpanel.track('[FilesEmptyState].clickCreateBlankFile');
                        }}
                      >
                        Create blank file
                      </Link>
                    ),
                    className: 'border-b border-border',
                  },
                  {
                    title: 'See what’s possible',
                    description: 'Like filtering and fetching data',
                    link: (
                      <Link
                        to={ROUTES.EXAMPLES}
                        onClick={() => {
                          mixpanel.track('[FilesEmptyState].clickExploreExamples');
                        }}
                      >
                        Explore examples
                      </Link>
                    ),
                    className: 'border-b border-border',
                  },
                  {
                    title: 'Deep dive',
                    description: 'All the details of using the app',
                    link: (
                      <Link
                        to={DOCUMENTATION_URL}
                        target="_blank"
                        onClick={() => {
                          mixpanel.track('[FilesEmptyState].clickReadDocs');
                        }}
                      >
                        Read the docs
                        <ExternalLinkIcon className="ml-2" />
                      </Link>
                    ),
                  },
                ].map(({ title, description, link, className }, i) => (
                  <div
                    key={i}
                    className={cn(`p-3 text-center sm:flex sm:items-center sm:justify-between sm:text-left`, className)}
                  >
                    <div className="mb-2 flex flex-col sm:mb-0">
                      <Type as="h2" className="font-semibold">
                        {title}
                      </Type>
                      <Type as="p" className={`text-muted-foreground`}>
                        {description}
                      </Type>
                    </div>

                    <Button asChild variant="secondary">
                      {link}
                    </Button>
                  </div>
                ))}
              </div>
            }
          />
        }
      />
    </>
  );
};

export const ErrorBoundary = () => {
  const error = useRouteError();
  const theme = useTheme();

  if (debugShowUILogs) console.error('[<MineRoute>.<ErrorBoundary>]', error);

  return (
    <Box sx={{ maxWidth: '60ch', mx: 'auto', py: theme.spacing(2) }}>
      <Empty
        title="Unexpected error"
        description="An unexpected error occurred while retrieving your files. Try reloading the page. If the issue continues, contact us."
        Icon={ExclamationTriangleIcon}
        severity="error"
      />
    </Box>
  );
};
