import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { FilesList, type FilesListUserFile } from '@/dashboard/components/FilesList';
import { FilesListEmptyState } from '@/dashboard/components/FilesListEmptyState';
import { NewFileButton } from '@/dashboard/components/NewFileButton';
import { OnboardingBanner } from '@/dashboard/components/OnboardingBanner';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { apiClient } from '@/shared/api/apiClient';
import { Avatar } from '@/shared/components/Avatar';
import { EmptyState } from '@/shared/components/EmptyState';
import { AddIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { cn } from '@/shared/shadcn/utils';
import { FileIcon } from '@radix-ui/react-icons';
import { useMemo } from 'react';
import { Link, useLoaderData, type LoaderFunctionArgs } from 'react-router';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const files = await apiClient.files.list({ shared: 'with-me' });
  const sharedWithMeFiles = files.map(({ name, uuid, createdDate, updatedDate, publicLinkAccess, thumbnail }) => ({
    name,
    thumbnail,
    createdDate,
    updatedDate,
    uuid,
    publicLinkAccess,
    permissions: [],
    fileType: 'shared',
  }));
  return { sharedWithMeFiles };
};

export const Component = () => {
  const { sharedWithMeFiles } = useLoaderData<typeof loader>();
  const {
    activeTeam: {
      team: { uuid: teamUuid },
      files: teamFiles,
      filesPrivate,
      userMakingRequest: { teamPermissions },
      users,
    },
  } = useDashboardRouteLoaderData();

  const canEdit = teamPermissions.includes('TEAM_EDIT');

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

  // The current user is always first in the users list (sorted in dashboard loader)
  const currentUser = useMemo(
    () => (users[0] ? { name: users[0].name, picture: users[0].picture, email: users[0].email } : undefined),
    [users]
  );

  // Combine team files + personal files + shared with me files, sorted by last modified date
  const suggestedFiles = useMemo(() => {
    const allFiles: FilesListUserFile[] = [];

    // Add team files
    teamFiles.forEach(({ file, userMakingRequest }) => {
      const creator = usersById[file.creatorId];
      allFiles.push({
        name: file.name,
        createdDate: file.createdDate,
        updatedDate: file.updatedDate,
        thumbnail: file.thumbnail,
        uuid: file.uuid,
        publicLinkAccess: file.publicLinkAccess,
        permissions: userMakingRequest.filePermissions,
        creator,
        fileType: 'team',
      });
    });

    // Add personal files
    filesPrivate.forEach(({ file, userMakingRequest }) => {
      allFiles.push({
        name: file.name,
        createdDate: file.createdDate,
        updatedDate: file.updatedDate,
        thumbnail: file.thumbnail,
        uuid: file.uuid,
        publicLinkAccess: file.publicLinkAccess,
        permissions: userMakingRequest.filePermissions,
        creator: currentUser,
        fileType: 'private',
      });
    });

    // Add shared with me files (avoid duplicates by checking UUID)
    const existingUuids = new Set(allFiles.map((f) => f.uuid));
    sharedWithMeFiles.forEach((file) => {
      if (!existingUuids.has(file.uuid)) {
        allFiles.push({ ...file, fileType: 'shared' });
      }
    });

    // Sort all files by last modified date (most recent first)
    return allFiles.sort((a, b) => new Date(b.updatedDate).getTime() - new Date(a.updatedDate).getTime());
  }, [teamFiles, filesPrivate, usersById, currentUser, sharedWithMeFiles]);

  const sharedAvatarClasses = '-ml-1 outline outline-2 outline-background';

  return (
    <div className="flex flex-grow flex-col">
      <OnboardingBanner />

      <DashboardHeader
        title="Files"
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden lg:block">
              <Link to={ROUTES.TEAM_MEMBERS(teamUuid)} className="flex items-center">
                {users.slice(0, 6).map((user, key) => (
                  <Avatar key={key} alt={user.name} src={user.picture} className={sharedAvatarClasses}>
                    {user.name ? user.name : user.email}
                  </Avatar>
                ))}
                <div
                  className={cn(
                    sharedAvatarClasses,
                    'flex h-6 w-6 items-center justify-center rounded-full bg-muted-foreground text-sm text-foreground'
                  )}
                >
                  <AddIcon className="text-background" />
                </div>
              </Link>
            </div>
            {canEdit && <NewFileButton isPrivate={false} />}
          </div>
        }
      />

      <FilesList
        files={suggestedFiles}
        teamUuid={teamUuid}
        isPrivate={false}
        emptyState={
          canEdit ? (
            <FilesListEmptyState />
          ) : (
            <EmptyState
              title="No team files yet"
              description={`Files created by your team members will show up here.`}
              Icon={FileIcon}
            />
          )
          // <EmptyState
          //   title="No suggested files"
          //   description="Files will appear here for quick access."
          //   Icon={FileIcon}
          // />
        }
      />
    </div>
  );
};
