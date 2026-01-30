import { userFilesListFiltersAtom } from '@/dashboard/atoms/userFilesListFiltersAtom';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { EmptyState } from '@/shared/components/EmptyState';
import { ROUTES } from '@/shared/constants/routes';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { FileIcon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { useAtomValue } from 'jotai';

export const UserFilesListEmptyState = ({ filesToRenderCount }: { filesToRenderCount: number }) => {
  const {
    activeTeam: {
      userMakingRequest: { teamPermissions },
    },
  } = useDashboardRouteLoaderData();
  const filters = useAtomValue(userFilesListFiltersAtom);
  const canEdit = teamPermissions.includes('TEAM_EDIT');

  // If there are files to render, don't show anything
  if (filesToRenderCount > 0) {
    return null;
  }

  // If there are no active filters, that means the user has 0 files
  if (
    filters.fileName === '' &&
    filters.fileCreatorEmails.length === 0 &&
    filters.sharedPublicly === false &&
    filters.hasScheduledTasks === false
  ) {
    // Shared files
    if (filters.fileType === 'shared') {
      return (
        <WrapperEmptyState>
          <EmptyState
            title="No shared files"
            description="When someone shares an individual file with you, it will be here."
            Icon={FileIcon}
          />
        </WrapperEmptyState>
      );
    }

    // All the others - What they see here depends on what they can do in the team
    return canEdit ? (
      <CreateFileEmptyState
        title={
          filters.fileType === 'private'
            ? 'No private files'
            : filters.fileType === 'team'
              ? 'No team files'
              : 'No files'
        }
        isPrivate={filters.fileType === 'private'}
      />
    ) : (
      <WrapperEmptyState>
        <EmptyState
          title="No team files yet"
          description={`Files created by your team members will show up here.`}
          Icon={FileIcon}
        />
      </WrapperEmptyState>
    );
  }

  // There must be active filters, show a generic empty state
  return (
    <WrapperEmptyState>
      <EmptyState title="No matches" description="No files found matching your filters." Icon={MagnifyingGlassIcon} />
    </WrapperEmptyState>
  );
};

const WrapperEmptyState = ({ className, children }: { className?: string; children: React.ReactNode }) => {
  return (
    <div className={cn('flex items-center justify-center border-2 border-transparent py-20', className)}>
      {children}
    </div>
  );
};

const CreateFileEmptyState = ({ isPrivate = false, title }: { isPrivate?: boolean; title?: string }) => {
  const {
    activeTeam: {
      team: { uuid: teamUuid },
    },
  } = useDashboardRouteLoaderData();

  const handleCreateFile = () => {
    trackEvent('[FilesEmptyState].clickCreateBlankFile');
    window.location.href = ROUTES.CREATE_FILE(teamUuid, { private: isPrivate });
  };

  return (
    <WrapperEmptyState className="border-dashed border-border">
      <EmptyState
        title={title ? title : 'No files'}
        description={
          <>
            <button onClick={handleCreateFile} className="underline hover:text-primary">
              Create a new file
            </button>{' '}
            or drag and drop a CSV, Excel, Parquet, or Quadratic file here.
          </>
        }
        Icon={FileIcon}
      />
    </WrapperEmptyState>
  );
};
