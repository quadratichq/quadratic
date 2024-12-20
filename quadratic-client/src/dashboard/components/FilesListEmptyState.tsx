import { Empty } from '@/dashboard/components/Empty';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { ROUTES } from '@/shared/constants/routes';
import { FileIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import { Link } from 'react-router-dom';

export const FilesListEmptyState = ({ isPrivate = false }: { isPrivate?: boolean }) => {
  const {
    activeTeam: {
      team: { uuid: teamUuid },
    },
  } = useDashboardRouteLoaderData();

  return (
    <div className="flex min-h-80 items-center justify-center border-2 border-dashed border-border">
      <Empty
        className="max-w-lg"
        title="No files"
        description={
          <>
            You don’t have any files yet.{' '}
            <Link
              to={isPrivate ? ROUTES.CREATE_FILE_PRIVATE(teamUuid) : ROUTES.CREATE_FILE(teamUuid)}
              reloadDocument
              className="underline hover:text-primary"
              onClick={() => {
                mixpanel.track('[FilesEmptyState].clickCreateBlankFile');
              }}
            >
              Create a new file
            </Link>{' '}
            or drag and drop a CSV, Excel, Parquet, or Quadratic file here.
          </>
        }
        Icon={FileIcon}
      />
    </div>
  );
};
