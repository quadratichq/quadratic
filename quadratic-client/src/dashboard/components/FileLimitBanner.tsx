import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { showUpgradeDialog } from '@/shared/atom/showUpgradeDialogAtom';
import { WarningIcon } from '@/shared/components/Icons';
import { useMemo } from 'react';

/**
 * Banner shown when the team has files that require upgrade to edit (billing-restricted).
 * This is distinct from "View only" which is permission-based.
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

  // Check if any files are edit-restricted and count editable files
  const { hasEditRestrictedFiles, editableFileCount } = useMemo(() => {
    const allFiles = [...teamFiles, ...filesPrivate];
    const restrictedCount = allFiles.filter(({ userMakingRequest }) => userMakingRequest.isFileEditRestricted).length;
    const editableCount = allFiles.length - restrictedCount;
    return {
      hasEditRestrictedFiles: restrictedCount > 0,
      editableFileCount: editableCount,
    };
  }, [teamFiles, filesPrivate]);

  // Don't show banner if on paid plan or no restricted files
  if (billingStatus === 'ACTIVE' || !hasEditRestrictedFiles) {
    return null;
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted">
        <WarningIcon className="h-5 w-5 text-warning" />
      </div>
      <p className="text-sm">
        Free file limit exceeded. You can only edit your <strong>{editableFileCount} most recently created</strong>{' '}
        Quadratic files.{' '}
        <button
          className="text-primary underline hover:text-primary/80"
          onClick={() => showUpgradeDialog('fileLimitReached')}
        >
          Upgrade for unlimited editable files.
        </button>
      </p>
    </div>
  );
}
