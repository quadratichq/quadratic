import CreateFileButton from '@/dashboard/components/CreateFileButton';
import { DashboardHeader } from '@/dashboard/components/DashboardHeader';
import { Empty } from '@/dashboard/components/Empty';
import { FilesList } from '@/dashboard/components/FilesList';
import { QDialogConfirmDelete } from '@/dashboard/components/QDialog';
import { useTeamRouteLoaderData } from '@/routes/teams.$teamUuid';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { FileIcon } from '@radix-ui/react-icons';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export const Component = () => {
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const loaderData = useTeamRouteLoaderData();

  const {
    team,
    files,
    userMakingRequest: { teamPermissions },
  } = loaderData;

  // TODO: (connections) optiistic UI update for name changes
  // let name = team.name;
  // if (fetcher.state !== 'idle' && isJsonObject(fetcher.json)) {
  //   name = (fetcher.json as TeamAction['request.update-team']).name;
  // }

  const canEdit = teamPermissions.includes('TEAM_EDIT');

  // TODO: (connections) move this to the settings page
  //
  // {teamPermissions.includes('TEAM_BILLING_EDIT') && (
  //   <DropdownMenuItem
  //     onClick={() => {
  //       // Get the billing session URL
  //       apiClient.teams.billing.getPortalSessionUrl(team.uuid).then((data) => {
  //         window.location.href = data.url;
  //       });
  //     }}
  //   >
  //     Update billing
  //   </DropdownMenuItem>
  // )}
  //
  // {isRenaming && (
  //   <DialogRenameItem
  //     itemLabel="Team"
  //     onClose={() => {
  //       setIsRenaming(false);
  //     }}
  //     value={name}
  //     onSave={(name: string) => {
  //       setIsRenaming(false);
  //       const data: TeamAction['request.update-team'] = { intent: 'update-team', name };
  //       fetcher.submit(data, { method: 'POST', encType: 'application/json' });
  //     }}
  //   />
  // )}

  return (
    <>
      <DashboardHeader title={'Team files'} actions={canEdit && <CreateFileButton />} />

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
          <Empty
            title="No team files yet"
            description={`Files created by${canEdit ? ' you or ' : ' '}your team members will show up here.`}
            actions={
              canEdit ? (
                <Button asChild variant="secondary">
                  <Link to={ROUTES.CREATE_FILE(team.uuid)}>Create a file</Link>
                </Button>
              ) : null
            }
            Icon={FileIcon}
          />
        }
      />

      {showDeleteDialog && (
        <QDialogConfirmDelete
          entityName={'Team name'}
          entityNoun="team"
          onClose={() => {
            setShowDeleteDialog(false);
          }}
          onDelete={() => {
            /* TODO */
          }}
        >
          Deleting this team will delete all associated data (such as files) for all users and billing will cease.
        </QDialogConfirmDelete>
      )}
    </>
  );
};
