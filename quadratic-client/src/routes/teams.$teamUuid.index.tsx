import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { FilesList, type FilesListUserFile } from '@/dashboard/components/FilesList';
import { NewFileButton } from '@/dashboard/components/NewFileButton';
import { OnboardingBanner } from '@/dashboard/components/OnboardingBanner';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { EmptyState } from '@/shared/components/EmptyState';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import type { RecentFile } from '@/shared/utils/updateRecentFiles';
import { RECENT_FILES_KEY } from '@/shared/utils/updateRecentFiles';
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
  const [recentFiles] = useLocalStorage<RecentFile[]>(RECENT_FILES_KEY, []);

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

  // Build a map of all available files (team + private) by UUID
  const allFilesMap = useMemo(() => {
    const map = new Map<string, FilesListUserFile>();

    // Add team files
    teamFiles.forEach(({ file, userMakingRequest }) => {
      const creator = usersById[file.creatorId];
      map.set(file.uuid, {
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

    // Add private files (use current user as creator since these are the user's own files)
    filesPrivate.forEach(({ file, userMakingRequest }) => {
      map.set(file.uuid, {
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

    return map;
  }, [teamFiles, filesPrivate, usersById, currentUser]);

  // Get recent files: combine localStorage recent files with team files
  const recentFilesWithDetails = useMemo(() => {
    // Start with localStorage recent files that exist in our available files
    const recentFromStorage = recentFiles
      .filter((file) => file.name.trim().length > 0)
      .map((recentFile) => allFilesMap.get(recentFile.uuid))
      .filter((file): file is FilesListUserFile => file !== undefined);

    // Get UUIDs of files already in the recent list
    const recentUuids = new Set(recentFromStorage.map((f) => f.uuid));

    // Add team files that aren't already in the recent list, sorted by last modified
    const additionalTeamFiles = teamFiles
      .map(({ file, userMakingRequest }) => {
        const creator = usersById[file.creatorId];
        return {
          name: file.name,
          createdDate: file.createdDate,
          updatedDate: file.updatedDate,
          thumbnail: file.thumbnail,
          uuid: file.uuid,
          publicLinkAccess: file.publicLinkAccess,
          permissions: userMakingRequest.filePermissions,
          creator,
          isPrivate: false,
        };
      })
      .filter((file) => !recentUuids.has(file.uuid))
      .sort((a, b) => new Date(b.updatedDate).getTime() - new Date(a.updatedDate).getTime());

    return [...recentFromStorage, ...additionalTeamFiles];
  }, [recentFiles, allFilesMap, teamFiles, usersById]);

  return (
    <div className="flex flex-grow flex-col">
      <OnboardingBanner />

      <DashboardHeader
        title="Suggested files"
        actions={<div className="flex items-center gap-2">{canEdit && <NewFileButton isPrivate={false} />}</div>}
      />

      <section className="">
        {recentFilesWithDetails.length === 0 ? (
          <EmptyState
            title="No suggested files"
            description="Files will appear here for quick access."
            Icon={FileIcon}
          />
        ) : (
          <FilesList files={recentFilesWithDetails} teamUuid={teamUuid} isPrivate={false} />
        )}
      </section>
    </div>
  );
};
