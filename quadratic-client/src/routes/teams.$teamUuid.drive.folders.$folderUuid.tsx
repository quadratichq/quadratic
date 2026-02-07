import { CreateFolderDialog } from '@/dashboard/components/CreateFolderDialog';
import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { FolderBreadcrumb } from '@/dashboard/components/FolderBreadcrumb';
import { FolderListItems } from '@/dashboard/components/FolderListItems';
import { NewFileButton } from '@/dashboard/components/NewFileButton';
import { UserFilesList, type UserFilesListFile } from '@/dashboard/components/UserFilesList';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { apiClient } from '@/shared/api/apiClient';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { useMemo, useState } from 'react';
import { useLoaderData, useRevalidator, type LoaderFunctionArgs } from 'react-router';

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { folderUuid } = params;
  if (!folderUuid) throw new Response('Folder UUID required', { status: 400 });
  const data = await apiClient.folders.get(folderUuid);
  return data;
};

export const Component = () => {
  const { folder, breadcrumbs, subfolders, files, filesPrivate } = useLoaderData<typeof loader>();
  const {
    activeTeam: {
      team: { uuid: teamUuid },
      userMakingRequest: { teamPermissions },
      users,
    },
  } = useDashboardRouteLoaderData();
  const revalidator = useRevalidator();
  const [showCreateFolder, setShowCreateFolder] = useState(false);

  const canEdit = teamPermissions.includes('TEAM_EDIT');

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

  const allFiles = useMemo(() => {
    const result: UserFilesListFile[] = [];

    files.forEach(({ file, userMakingRequest }) => {
      const creator = usersById[file.creatorId];
      result.push({
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

    filesPrivate.forEach(({ file, userMakingRequest }) => {
      result.push({
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

    return result.sort((a, b) => new Date(b.updatedDate).getTime() - new Date(a.updatedDate).getTime());
  }, [files, filesPrivate, usersById, currentUser]);

  const isPrivateFolder = folder.ownerUserId !== null;
  const rootName = isPrivateFolder ? 'Private Files' : 'Team Files';
  const rootHref = isPrivateFolder ? ROUTES.TEAM_DRIVE_PRIVATE(teamUuid) : ROUTES.TEAM_DRIVE_TEAM(teamUuid);

  const breadcrumbItems = [
    { name: rootName, href: rootHref },
    ...breadcrumbs.map((b) => ({
      name: b.name,
      href: ROUTES.TEAM_DRIVE_FOLDER(teamUuid, b.uuid),
    })),
    { name: folder.name },
  ];

  return (
    <div className="flex flex-grow flex-col" onDragOver={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()}>
      <DashboardHeader
        title={folder.name}
        titleNode={
          <div className="min-w-0 flex-1 overflow-hidden">
            <FolderBreadcrumb items={breadcrumbItems} />
          </div>
        }
        actions={
          (isPrivateFolder || canEdit) && (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setShowCreateFolder(true)}>
                New folder
              </Button>
              <NewFileButton />
            </div>
          )
        }
      />

      {subfolders.length > 0 && (
        <FolderListItems
          folders={subfolders}
          teamUuid={teamUuid}
          ownerUserId={folder.ownerUserId}
          canEdit={isPrivateFolder || canEdit}
        />
      )}

      <UserFilesList files={allFiles} teamUuid={teamUuid} hideTypeFilters />

      {showCreateFolder && (
        <CreateFolderDialog
          teamUuid={teamUuid}
          parentFolderUuid={folder.uuid}
          isPrivate={isPrivateFolder}
          onClose={() => {
            setShowCreateFolder(false);
            revalidator.revalidate();
          }}
        />
      )}
    </div>
  );
};
