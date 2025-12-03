import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { FilesList, type FilesListUserFile } from '@/dashboard/components/FilesList';
import { NewFileButton } from '@/dashboard/components/NewFileButton';
import { OnboardingBanner } from '@/dashboard/components/OnboardingBanner';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { EmptyState } from '@/shared/components/EmptyState';
import { FileIcon } from '@radix-ui/react-icons';
import { useMemo } from 'react';

export const Component = () => {
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

  // Combine team files + personal files, sorted by last modified date
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
        isPrivate: false,
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
      });
    });

    // Sort all files by last modified date (most recent first)
    return allFiles.sort((a, b) => new Date(b.updatedDate).getTime() - new Date(a.updatedDate).getTime());
  }, [teamFiles, filesPrivate, usersById, currentUser]);

  return (
    <div className="flex flex-grow flex-col">
      <OnboardingBanner />

      <DashboardHeader
        title="Suggested files"
        actions={<div className="flex items-center gap-2">{canEdit && <NewFileButton isPrivate={false} />}</div>}
      />

      <section className="">
        {suggestedFiles.length === 0 ? (
          <EmptyState
            title="No suggested files"
            description="Files will appear here for quick access."
            Icon={FileIcon}
          />
        ) : (
          <FilesList files={suggestedFiles} teamUuid={teamUuid} isPrivate={false} />
        )}
      </section>
    </div>
  );
};
