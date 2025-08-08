import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { EmptyState } from '@/shared/components/EmptyState';
import { ROUTES } from '@/shared/constants/routes';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { FileIcon } from '@radix-ui/react-icons';
import { Link } from 'react-router';

export const FilesListEmptyState = ({ isPrivate = false }: { isPrivate?: boolean }) => {
  const {
    activeTeam: {
      team: { uuid: teamUuid },
    },
  } = useDashboardRouteLoaderData();

  return (
    <div className="flex min-h-80 items-center justify-center border-2 border-dashed border-border">
      <EmptyState
        className="max-w-lg"
        title="No files"
        description={
          <>
            You don’t have any files yet.{' '}
            <Link
              to={ROUTES.CREATE_FILE(teamUuid, { private: isPrivate })}
              reloadDocument
              className="underline hover:text-primary"
              onClick={() => {
                trackEvent('[FilesEmptyState].clickCreateBlankFile');
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
