import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { FileLimitBanner } from '@/dashboard/components/FileLimitBanner';
import { FilesList } from '@/dashboard/components/FilesList';
import { FilesListEmptyState } from '@/dashboard/components/FilesListEmptyState';
import { NewFileButton } from '@/dashboard/components/NewFileButton';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { Avatar } from '@/shared/components/Avatar';
import { EmptyState } from '@/shared/components/EmptyState';
import { AddIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { cn } from '@/shared/shadcn/utils';
import { FileIcon } from '@radix-ui/react-icons';
import { Link } from 'react-router';

export const Component = () => {
  const {
    activeTeam: {
      team: { uuid: teamUuid },
      files,
      userMakingRequest: { teamPermissions },
      users,
    },
  } = useDashboardRouteLoaderData();
  const canEdit = teamPermissions.includes('TEAM_EDIT');

  const usersById: Record<
    number,
    { name: string | undefined; picture: string | undefined; email: string | undefined }
  > = users.reduce(
    (acc, user) => ({
      ...acc,
      [user.id]: { name: user.name, picture: user.picture, email: user.email },
    }),
    {}
  );

  const sharedAvatarClasses = '-ml-1 outline outline-2 outline-background';

  return (
    <div className="flex flex-grow flex-col">
      <FileLimitBanner />
      <DashboardHeader
        title="Team files"
        actions={
          <div className={`flex items-center gap-2`}>
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
        files={files.map(({ file, userMakingRequest }) => {
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
            isFileEditRestricted: userMakingRequest.isFileEditRestricted,
          };
        })}
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
        }
      />
    </div>
  );
};
