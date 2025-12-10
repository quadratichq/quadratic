import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { showUpgradeDialog } from '@/shared/atom/showUpgradeDialogAtom';
import { LockClosedIcon } from '@radix-ui/react-icons';
import { useMemo } from 'react';

/**
 * Banner shown when the team has files that are view-only due to billing limits.
 * This is non-dismissable and prompts the user to upgrade.
 */
export function FileLimitBanner() {
  const {
    activeTeam: {
      files: teamFiles,
      filesPrivate,
      billing: { status: billingStatus },
    },
  } = useDashboardRouteLoaderData();

  // Check if any files are edit-restricted due to billing limits
  const hasEditRestrictedFiles = useMemo(() => {
    const teamFilesRestricted = teamFiles.some(({ userMakingRequest }) => userMakingRequest.isFileEditRestricted);
    const privateFilesRestricted = filesPrivate.some(({ userMakingRequest }) => userMakingRequest.isFileEditRestricted);
    return teamFilesRestricted || privateFilesRestricted;
  }, [teamFiles, filesPrivate]);

  // Don't show banner if on paid plan or no restricted files
  if (billingStatus === 'ACTIVE' || !hasEditRestrictedFiles) {
    return null;
  }

  return (
    <div className="mb-4 mt-4 flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted">
        <LockClosedIcon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-sm">
        You can edit your <strong>3 most recently created</strong> Quadratic files and the rest are view-only.{' '}
        <button
          className="text-primary underline hover:text-primary/80"
          onClick={() => showUpgradeDialog('fileLimitReached')}
        >
          Upgrade for unlimited editing.
        </button>
      </p>
    </div>
  );
}
