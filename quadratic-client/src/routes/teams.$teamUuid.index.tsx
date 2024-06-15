import CreateFileButton from '@/dashboard/components/CreateFileButton';
import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { Empty } from '@/dashboard/components/Empty';
import { FilesList } from '@/dashboard/components/FilesList';
import { FilesListEmptyState } from '@/dashboard/components/FilesListEmptyState';
import { useTeamRouteLoaderData } from '@/routes/teams.$teamUuid';
import { FileIcon } from '@radix-ui/react-icons';

export const Component = () => {
  const {
    files,
    userMakingRequest: { teamPermissions },
  } = useTeamRouteLoaderData();

  const canEdit = teamPermissions.includes('TEAM_EDIT');

  return (
    <>
      <DashboardHeader title="Team files" actions={canEdit && <CreateFileButton />} />

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
