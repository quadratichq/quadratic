import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { FileLimitBanner } from '@/dashboard/components/FileLimitBanner';
import { NewFileButton } from '@/dashboard/components/NewFileButton';
import { OnboardingBanner } from '@/dashboard/components/OnboardingBanner';
import { UserFilesList, type UserFilesListFile } from '@/dashboard/components/UserFilesList';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { apiClient } from '@/shared/api/apiClient';
import { useMemo } from 'react';
import { useLoaderData, type LoaderFunctionArgs } from 'react-router';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // TODO: (jimniels) we might want to just put this into the default dashboard
  // loader data rather than loading from another endpoint since it's all combined now
  const files = await apiClient.files.list({ shared: 'with-me' });
  const sharedWithMeFiles = files.map(
    ({ name, uuid, createdDate, updatedDate, publicLinkAccess, thumbnail, hasScheduledTasks }) => ({
      hasScheduledTasks,
      name,
      thumbnail,
      createdDate,
      updatedDate,
      uuid,
      publicLinkAccess,
      // Hard-code permissions to and don't allow user to take actions on the dashboard
      permissions: [],
      fileType: 'shared' as const,
    })
  );
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
    const allFiles: UserFilesListFile[] = [];

    // Add team files
    teamFiles.forEach(({ file, userMakingRequest }) => {
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

    // Add personal files
    filesPrivate.forEach(({ file, userMakingRequest }) => {
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

    // Add shared with me files (avoid duplicates by checking UUID)
    const existingUuids = new Set(allFiles.map((f) => f.uuid));
    sharedWithMeFiles.forEach((file) => {
      if (!existingUuids.has(file.uuid)) {
        allFiles.push({ ...file, hasScheduledTasks: file.hasScheduledTasks, fileType: 'shared' });
      }
    });

    // Sort all files by last modified date (most recent first)
    return allFiles.sort((a, b) => new Date(b.updatedDate).getTime() - new Date(a.updatedDate).getTime());
  }, [teamFiles, filesPrivate, usersById, currentUser, sharedWithMeFiles]);

  // const sharedAvatarClasses = '-ml-1 outline outline-2 outline-background';

  return (
    <div className="flex flex-grow flex-col">
      <OnboardingBanner />

      <DashboardHeader title="Files" actions={canEdit && <NewFileButton />} />

      <FileLimitBanner />

      <UserFilesList files={suggestedFiles} teamUuid={teamUuid} />
    </div>
  );
};
