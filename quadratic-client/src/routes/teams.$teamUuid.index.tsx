import { Add } from '@mui/icons-material';
import { Avatar, AvatarGroup } from '@mui/material';
import { FileIcon } from '@radix-ui/react-icons';
import { Link } from 'react-router-dom';

import CreateFileButton from '@/dashboard/components/CreateFileButton';
import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { Empty } from '@/dashboard/components/Empty';
import { FilesList } from '@/dashboard/components/FilesList';
import { FilesListEmptyState } from '@/dashboard/components/FilesListEmptyState';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { ROUTES } from '@/shared/constants/routes';

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
  const avatarSxProps = { width: 24, height: 24, fontSize: '.875rem' };

  return (
    <>
      <DashboardHeader
        title="Team files"
        actions={
          <div className={`flex items-center gap-2`}>
            <div className="hidden lg:block">
              <Link to={ROUTES.TEAM_MEMBERS(teamUuid)}>
                <AvatarGroup
                  max={6}
                  sx={{ cursor: 'pointer', pr: 0 }}
                  slotProps={{ additionalAvatar: { sx: avatarSxProps } }}
                >
                  <Avatar alt="Add" sx={{ ...avatarSxProps }} className="text-sm">
                    <Add fontSize="inherit" />
                  </Avatar>
                  {users.map((user, key) => (
                    <Avatar key={key} alt={user.name} src={user.picture} sx={avatarSxProps} />
                  ))}
                </AvatarGroup>
              </Link>
            </div>
            {canEdit && <CreateFileButton />}
          </div>
        }
      />

      <FilesList
        files={files.map(({ file, userMakingRequest }) => ({
          name: file.name,
          createdDate: file.createdDate,
          updatedDate: file.updatedDate,
          thumbnail: file.thumbnail,
          uuid: file.uuid,
          publicLinkAccess: file.publicLinkAccess,
          permissions: userMakingRequest.filePermissions,
        }))}
        emptyState={
          canEdit ? (
            <FilesListEmptyState />
          ) : (
            <Empty
              title="No team files yet"
              description={`Files created by your team members will show up here.`}
              Icon={FileIcon}
            />
          )
        }
      />
    </>
  );
};
