import CreateFileButton from '@/dashboard/components/CreateFileButton';
import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { Empty } from '@/dashboard/components/Empty';
import { FilesList } from '@/dashboard/components/FilesList';
import { FilesListEmptyState } from '@/dashboard/components/FilesListEmptyState';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { apiClient } from '@/shared/api/apiClient';
import { FileIcon } from '@radix-ui/react-icons';
import { LoaderFunctionArgs, useLoaderData } from 'react-router-dom';

type LoaderData = Awaited<ReturnType<typeof loader>>;

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const teamUuid = params.teamUuid;
  if (!teamUuid) throw new Error('No team UUID provided');

  const data = await apiClient.teams.files.list(teamUuid, false);
  return data;
};

export const Component = () => {
  const { files } = useLoaderData() as LoaderData;
  const {
    activeTeam: {
      userMakingRequest: { teamPermissions },
    },
  } = useDashboardRouteLoaderData();
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
