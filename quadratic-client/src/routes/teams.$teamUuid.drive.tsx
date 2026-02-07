import { CreateFolderDialog } from '@/dashboard/components/CreateFolderDialog';
import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { FolderListItems } from '@/dashboard/components/FolderListItems';
import { NewFileButton } from '@/dashboard/components/NewFileButton';
import { UserFilesList, type UserFilesListFile } from '@/dashboard/components/UserFilesList';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { Button } from '@/shared/shadcn/ui/button';
import { useMemo, useState } from 'react';
import { useLocation } from 'react-router';

export const Component = () => {
  const {
    activeTeam: {
      team: { uuid: teamUuid },
      files: teamFiles,
      filesPrivate,
      folders,
      userMakingRequest: { teamPermissions },
      users,
    },
    userMakingRequest: { id: userId },
  } = useDashboardRouteLoaderData();
  const location = useLocation();
  const [showCreateFolder, setShowCreateFolder] = useState(false);

  // Determine which ownership type based on the URL
  const isPrivateView = location.pathname.endsWith('/private');
  const canEdit = teamPermissions.includes('TEAM_EDIT');

  const title = isPrivateView ? 'Private Files' : 'Team Files';

  // Build a map of users by ID for creator info
  const usersById: Record<number, { name?: string; picture?: string; email?: string }> = useMemo(
    () =>
      users.reduce(
        (acc, user) => ({
          ...acc,
          [user.id]: { name: user.name, picture: user.picture, email: user.email },
        }),
        {}
      ),
    [users]
  );

  const currentUser = useMemo(
    () => (users[0] ? { name: users[0].name, picture: users[0].picture, email: users[0].email } : undefined),
    [users]
  );

  // Get top-level folders (no parent) filtered by ownership type
  const topLevelFolders = useMemo(
    () =>
      folders.filter((f) => {
        if (f.parentFolderUuid) return false; // Only root-level
        if (isPrivateView) return f.ownerUserId !== null;
        return f.ownerUserId === null;
      }),
    [folders, isPrivateView]
  );

  // Get root-level files filtered by ownership type
  const rootFiles = useMemo(() => {
    const allFiles: UserFilesListFile[] = [];

    if (!isPrivateView) {
      // Team view: show team files without a folder
      teamFiles.forEach(({ file, userMakingRequest }) => {
        if (file.folderUuid) return;
        const creator = usersById[file.creatorId];
        allFiles.push({
          hasScheduledTasks: file.hasScheduledTasks,
          name: file.name,
          createdDate: file.createdDate,
          updatedDate: file.updatedDate,
          thumbnail: file.thumbnail,
          uuid: file.uuid,
          publicLinkAccess: file.publicLinkAccess,
          permissions: userMakingRequest.filePermissions,
          creator,
          fileType: 'team',
          requiresUpgradeToEdit: userMakingRequest.requiresUpgradeToEdit,
        });
      });
    } else {
      // Private view: show private files without a folder
      filesPrivate.forEach(({ file, userMakingRequest }) => {
        if (file.folderUuid) return;
        allFiles.push({
          hasScheduledTasks: file.hasScheduledTasks,
          name: file.name,
          createdDate: file.createdDate,
          updatedDate: file.updatedDate,
          thumbnail: file.thumbnail,
          uuid: file.uuid,
          publicLinkAccess: file.publicLinkAccess,
          permissions: userMakingRequest.filePermissions,
          creator: currentUser,
          fileType: 'private',
          requiresUpgradeToEdit: userMakingRequest.requiresUpgradeToEdit,
        });
      });
    }

    return allFiles.sort((a, b) => new Date(b.updatedDate).getTime() - new Date(a.updatedDate).getTime());
  }, [teamFiles, filesPrivate, usersById, currentUser, isPrivateView]);

  return (
    <div className="flex flex-grow flex-col" onDragOver={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()}>
      <DashboardHeader
        title={title}
        titleNode={<span className="text-sm font-medium">{title}</span>}
        actions={
          (isPrivateView || canEdit) && (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setShowCreateFolder(true)}>
                New folder
              </Button>
              <NewFileButton />
            </div>
          )
        }
      />

      {topLevelFolders.length > 0 && (
        <FolderListItems
          folders={topLevelFolders}
          teamUuid={teamUuid}
          ownerUserId={isPrivateView ? userId : null}
          canEdit={isPrivateView || canEdit}
        />
      )}

      <UserFilesList files={rootFiles} teamUuid={teamUuid} hideTypeFilters />

      {showCreateFolder && (
        <CreateFolderDialog teamUuid={teamUuid} isPrivate={isPrivateView} onClose={() => setShowCreateFolder(false)} />
      )}
    </div>
  );
};
