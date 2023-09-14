import { DeleteOutline, IosShare, MoreVert } from '@mui/icons-material';
import { Box, Divider, IconButton, Menu, MenuItem, Stack, useMediaQuery, useTheme } from '@mui/material';
import { useEffect, useState } from 'react';
import { useFetcher } from 'react-router-dom';
import { deleteFile, downloadFile, duplicateFile, renameFile as renameFileAction } from '../../actions';
import { useGlobalSnackbar } from '../../components/GlobalSnackbarProvider';
import { ROUTES } from '../../constants/routes';
import { TooltipHint } from '../../ui/components/TooltipHint';
import { DashboardFileLink } from '../components/DashboardFileLink';
import { Action, ListFile } from './MineRoute';
import { FileListItemInput } from './MineRouteFileListItemInput';

type Props = {
  file: ListFile;
  activeShareMenuFileId: string;
  setActiveShareMenuFileId: Function;
};

export function FileListItem({ file, activeShareMenuFileId, setActiveShareMenuFileId }: Props) {
  const theme = useTheme();
  const fetcherDelete = useFetcher();
  const fetcherDownload = useFetcher();
  const fetcherDuplicate = useFetcher();
  const fetcherRename = useFetcher();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  const { uuid, name, updated_date, public_link_access } = file;
  const open = Boolean(anchorEl);
  const failedToDelete = fetcherDelete.data && !fetcherDelete.data.ok;
  const failedToRename = fetcherRename.data && !fetcherRename.data.ok;

  // If the download files, show an error in the UI
  // TODO async communication in UI that the file is downloading?
  useEffect(() => {
    if (fetcherDownload.data && !fetcherDownload.data.ok) {
      addGlobalSnackbar('Failed to download file. Try again.', { severity: 'error' });
    }
  }, [addGlobalSnackbar, fetcherDownload.data]);

  // Optimistically hide this file if it's being deleted
  if (fetcherDelete.state === 'submitting' || fetcherDelete.state === 'loading') {
    return null;
  }

  const handleActionsMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setAnchorEl(event.currentTarget);
  };

  const handleActionsMenuClose = () => {
    setAnchorEl(null);
  };

  const renameFile = (value: string) => {
    setIsRenaming(false);

    // Don't allow empty file names
    if (!(value && value.trim())) {
      return;
    }

    // Don't do anything if the name didn't change
    if (value === name) {
      return;
    }

    // Otherwise update on the server and optimistically in the UI
    const data: Action['request.rename'] = { uuid, action: 'rename', name: value };
    fetcherRename.submit(data, { method: 'POST', encType: 'application/json' });
  };

  const handleDelete = () => {
    if (window.confirm(`Confirm you want to delete the file: “${name}”`)) {
      const data: Action['request.delete'] = {
        uuid,
        action: 'delete',
      };
      fetcherDelete.submit(data, { method: 'POST', encType: 'application/json' });
    }
    handleActionsMenuClose();
  };

  const handleDownload = () => {
    const data: Action['request.download'] = {
      action: 'download',
      uuid,
    };
    fetcherDownload.submit(data, { method: 'POST', encType: 'application/json' });
    handleActionsMenuClose();
  };

  const handleDuplicate = () => {
    const date = new Date().toISOString();
    const data: Action['request.duplicate'] = {
      action: 'duplicate',
      uuid,
      // These are the values that will optimistically render in the UI
      file: {
        uuid: 'duplicate-' + date,
        public_link_access: 'NOT_SHARED',
        name: name + ' (Copy)',
        updated_date: date,
        created_date: date,
      },
    };
    fetcherDuplicate.submit(data, { method: 'POST', encType: 'application/json' });
    handleActionsMenuClose();
  };

  const handleRename = () => {
    setIsRenaming(true);
    handleActionsMenuClose();
  };

  const handleShare = () => {
    setActiveShareMenuFileId(uuid);
    handleActionsMenuClose();
  };

  return (
    <Box sx={{ position: 'relative', '&:hover .additional-icons': { display: isDesktop ? 'block' : 'none' } }}>
      <DashboardFileLink
        key={uuid}
        to={ROUTES.FILE(uuid)}
        name={fetcherRename.json ? (fetcherRename.json as Action['request.rename']).name : name}
        description={`Updated ${timeAgo(updated_date)}`}
        descriptionError={failedToDelete || failedToRename ? 'Failed to sync changes' : ''}
        disabled={uuid.startsWith('duplicate-') || isRenaming}
        isShared={public_link_access !== 'NOT_SHARED'}
        actions={
          <Stack gap={theme.spacing(1)} alignItems="center" direction="row">
            <Box className="additional-icons" sx={{ display: 'none' }}>
              <TooltipHint title="Share">
                <IconButton
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.preventDefault();
                    handleShare();
                  }}
                >
                  <IosShare />
                </IconButton>
              </TooltipHint>
              <TooltipHint title="Delete">
                <IconButton
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.preventDefault();
                    handleDelete();
                  }}
                >
                  <DeleteOutline />
                </IconButton>
              </TooltipHint>
            </Box>

            <TooltipHint title="More…">
              <IconButton
                id="file-actions-button"
                aria-controls={open ? 'file-actions-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                onClick={handleActionsMenuClick}
              >
                <MoreVert />
              </IconButton>
            </TooltipHint>
            <Menu
              id="file-actions-menu"
              anchorEl={anchorEl}
              open={open}
              onClose={handleActionsMenuClose}
              MenuListProps={{
                'aria-labelledby': 'file-actions-button',
              }}
            >
              <MenuItem dense onClick={handleShare}>
                Share
              </MenuItem>

              <MenuItem dense onClick={handleDuplicate}>
                {duplicateFile.label}
              </MenuItem>

              <MenuItem dense onClick={handleRename}>
                {renameFileAction.label}
              </MenuItem>

              <MenuItem dense onClick={handleDownload}>
                {downloadFile.label}
              </MenuItem>

              <Divider />
              <MenuItem dense onClick={handleDelete}>
                {deleteFile.label}
              </MenuItem>
            </Menu>
          </Stack>
        }
      />
      {isRenaming && <FileListItemInput setValue={renameFile} value={name} />}
      <Divider />
    </Box>
  );
}

// Vanilla js time formatter. Adapted from:
// https://blog.webdevsimplified.com/2020-07/relative-time-format/
const formatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
});
const DIVISIONS: { amount: number; name: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, name: 'seconds' },
  { amount: 60, name: 'minutes' },
  { amount: 24, name: 'hours' },
  { amount: 7, name: 'days' },
  { amount: 4.34524, name: 'weeks' },
  { amount: 12, name: 'months' },
  { amount: Number.POSITIVE_INFINITY, name: 'years' },
];
export function timeAgo(dateString: string) {
  const date: Date = new Date(dateString);

  let duration = (date.getTime() - new Date().getTime()) / 1000;

  for (let i = 0; i < DIVISIONS.length; i++) {
    const division = DIVISIONS[i];
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.name);
    }
    duration /= division.amount;
  }
}
