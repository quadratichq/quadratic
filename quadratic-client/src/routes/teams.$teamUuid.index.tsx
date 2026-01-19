import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { FileLimitBanner } from '@/dashboard/components/FileLimitBanner';
import { FilesList, type FilesListUserFile } from '@/dashboard/components/FilesList';
import { NewFileButton } from '@/dashboard/components/NewFileButton';
import { OnboardingBanner } from '@/dashboard/components/OnboardingBanner';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { apiClient } from '@/shared/api/apiClient';
import { EmptyState } from '@/shared/components/EmptyState';
import { FileIcon } from '@radix-ui/react-icons';
import { useMemo } from 'react';
import { useLoaderData, type LoaderFunctionArgs } from 'react-router';

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
    isSharedWithMe: true,
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
        hasScheduledTasks: file.hasScheduledTasks,
        creator,
        isPrivate: false,
        isFileEditRestricted: userMakingRequest.isFileEditRestricted,
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
        isPrivate: true,
        isFileEditRestricted: userMakingRequest.isFileEditRestricted,
      });
    });

    // Add shared with me files (avoid duplicates by checking UUID)
    const existingUuids = new Set(allFiles.map((f) => f.uuid));
    sharedWithMeFiles.forEach((file) => {
      if (!existingUuids.has(file.uuid)) {
        allFiles.push(file);
      }
    });

    // Sort all files by last modified date (most recent first)
    return allFiles.sort((a, b) => new Date(b.updatedDate).getTime() - new Date(a.updatedDate).getTime());
  }, [teamFiles, filesPrivate, usersById, currentUser, sharedWithMeFiles]);

  return (
    <div className="flex flex-grow flex-col">
      <OnboardingBanner />
      <FileLimitBanner />

      <DashboardHeader
        title="Suggested files"
        actions={<div className="flex items-center gap-2">{canEdit && <NewFileButton isPrivate={false} />}</div>}
      />

      <FilesList
        files={suggestedFiles}
        teamUuid={teamUuid}
        isPrivate={false}
        emptyState={
          <EmptyState
            title="No suggested files"
            description="Files will appear here for quick access."
            Icon={FileIcon}
          />
        }
      />
    </div>
  );
};
