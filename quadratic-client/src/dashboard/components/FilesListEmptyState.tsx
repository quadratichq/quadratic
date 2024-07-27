import { ExternalLinkIcon, FileIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import { Link } from 'react-router-dom';

import { Empty } from '@/dashboard/components/Empty';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { DOCUMENTATION_URL } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';

export const FilesListEmptyState = ({ isPrivate }: { isPrivate?: boolean }) => {
  const {
    activeTeam: {
      team: { uuid: activeTeamUuid },
    },
  } = useDashboardRouteLoaderData();

  return (
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
                  to={ROUTES.CREATE_FILE_EXAMPLE(
                    activeTeamUuid,
                    'https://app.quadratichq.com/file/abb7cb2f-2cc7-46bb-9c83-a86f0c8d4834',
                    Boolean(isPrivate)
                  )}
                  reloadDocument
                  onClick={() => {
                    mixpanel.track('[FilesEmptyState].clickOpenStarterFile');
                  }}
                >
                  Open starter file
                </Link>
              ),
              className: 'border border-primary',
            },
            {
              title: 'Get started',
              description: 'With a fresh new file',
              link: (
                <Link
                  to={isPrivate ? ROUTES.CREATE_FILE_PRIVATE(activeTeamUuid) : ROUTES.CREATE_FILE(activeTeamUuid)}
                  reloadDocument
                  onClick={() => {
                    mixpanel.track('[FilesEmptyState].clickCreateBlankFile');
                  }}
                >
                  Create blank file
                </Link>
              ),
              className: 'border-l border-l-transparent border-r border-r-transparent border-b border-b-border',
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
              className: 'border-l border-l-transparent border-r border-r-transparent border-b border-b-border',
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
              className: 'border-l border-l-transparent border-r border-r-transparent',
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
  );
};
