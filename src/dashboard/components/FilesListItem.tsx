import { DeleteOutline, IosShare, MoreVert } from '@mui/icons-material';
import { Box, Divider, IconButton, Menu, MenuItem, Stack, useMediaQuery, useTheme } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { Link, SubmitOptions, useFetcher } from 'react-router-dom';
import { deleteFile, downloadFile, duplicateFile, renameFile as renameFileAction } from '../../actions';
import { useGlobalSnackbar } from '../../components/GlobalSnackbarProvider';
import { ROUTES } from '../../constants/routes';
import { TooltipHint } from '../../ui/components/TooltipHint';
import { Action, FilesListFile } from './FilesList';
import { FilesListItemCore } from './FilesListItemCore';
import { Layout, Sort, ViewPreferences } from './FilesListViewControlsDropdown';

export function FilesListItems({ children, viewPreferences }: any) {
  const theme = useTheme();

  return (
    <Box
      sx={
        viewPreferences.layout === Layout.Grid
          ? {
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: theme.spacing(3),
              pb: theme.spacing(),

              [theme.breakpoints.up('md')]: {
                px: theme.spacing(),
              },
            }
          : {}
      }
    >
      {children}
    </Box>
  );
}

export function FileListItem({
  file,
  filterValue,
  activeShareMenuFileId,
  setActiveShareMenuFileId,
  viewPreferences,
}: {
  file: FilesListFile;
  filterValue: string;
  activeShareMenuFileId: string;
  setActiveShareMenuFileId: Function;
  viewPreferences: ViewPreferences;
}) {
  const theme = useTheme();
  const fetcherDelete = useFetcher();
  const fetcherDownload = useFetcher();
  const fetcherDuplicate = useFetcher();
  const fetcherRename = useFetcher();
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  const { uuid, name, created_date, updated_date, public_link_access } = file;

  const fetcherSubmitOpts: SubmitOptions = {
    method: 'POST',
    action: ROUTES.API_FILE(uuid),
    encType: 'application/json',
  };
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
    const data: Action['request.rename'] = { action: 'rename', name: value };
    fetcherRename.submit(data, fetcherSubmitOpts);
  };

  const handleDelete = () => {
    if (window.confirm(`Confirm you want to delete the file: “${name}”`)) {
      const data: Action['request.delete'] = {
        action: 'delete',
      };
      fetcherDelete.submit(data, fetcherSubmitOpts);
    }
    handleActionsMenuClose();
  };

  const handleDownload = () => {
    const data: Action['request.download'] = {
      action: 'download',
    };
    fetcherDownload.submit(data, fetcherSubmitOpts);
    handleActionsMenuClose();
  };

  const handleDuplicate = () => {
    const date = new Date().toISOString();
    const data: Action['request.duplicate'] = {
      action: 'duplicate',

      // These are the values that will optimistically render in the UI
      file: {
        uuid: 'duplicate-' + date,
        public_link_access: 'NOT_SHARED',
        name: name + ' (Copy)',
        updated_date: date,
        created_date: date,
      },
    };
    fetcherDuplicate.submit(data, fetcherSubmitOpts);
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

  const displayName = fetcherRename.json ? (fetcherRename.json as Action['request.rename']).name : name;
  const displayNameHtml = filterValue ? highlightMatchingString(displayName, filterValue) : displayName;
  const displayDescription =
    viewPreferences.sort === Sort.Created ? `Created ${timeAgo(created_date)}` : `Updated ${timeAgo(updated_date)}`;
  const hasNetworkError = Boolean(failedToDelete || failedToRename);
  const isDisabled = uuid.startsWith('duplicate-') || isRenaming;
  const isShared = public_link_access !== 'NOT_SHARED';
  const to = ROUTES.FILE(uuid);

  const MoreButton = (
    <TooltipHint title="More…">
      <IconButton
        id="file-actions-button"
        aria-controls={open ? 'files-list-item-actions-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleActionsMenuClick}
      >
        <MoreVert />
      </IconButton>
    </TooltipHint>
  );

  const sharedProps = {
    key: uuid,
    filterValue,
    name: displayNameHtml,
    description: displayDescription,
    hasNetworkError: hasNetworkError,
    isShared,
    isRenaming,
    renameFile,
    viewPreferences,
  };

  return (
    <>
      {viewPreferences.layout === Layout.List && <Divider />}
      <Link
        key={uuid}
        to={to}
        reloadDocument
        style={{
          textDecoration: 'none',
          color: 'inherit',
          ...(isDisabled ? { pointerEvents: 'none', opacity: 0.5 } : {}),
        }}
      >
        {viewPreferences.layout === Layout.Grid ? (
          <Stack
            sx={{
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: '2px',
              '&:hover': { borderColor: theme.palette.text.secondary },
            }}
          >
            <Box sx={{ aspectRatio: '16/9' }}>
              <Box
                sx={{
                  backgroundImage: 'url(https://placehold.co/800x450)',
                  backgroundPosition: '50%',
                  width: '100%',
                  height: '100%',
                  backgroundSize: 'cover',
                }}
              />
            </Box>
            <Divider />
            <Box
              sx={{
                px: theme.spacing(1),
                py: theme.spacing(1),
              }}
            >
              <FilesListItemCore {...sharedProps} actions={MoreButton} />
            </Box>
          </Stack>
        ) : (
          <Box
            sx={{
              px: theme.spacing(1),
              py: theme.spacing(1.5),
              [theme.breakpoints.down('md')]: {
                px: 0,
              },
              '&:hover': { backgroundColor: theme.palette.action.hover },
              '&:hover .additional-icons': { display: isDesktop ? 'block' : 'none' },
            }}
          >
            <FilesListItemCore
              {...sharedProps}
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

                  {MoreButton}
                </Stack>
              }
            />
          </Box>
        )}
      </Link>
      <Menu
        id="files-list-item-actions-menu"
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
    </>
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

function highlightMatchingString(inputString: string, searchString: string) {
  const regex = new RegExp(searchString, 'gi'); // case insensitive matching
  const highlightedString = inputString.replace(regex, (match: string) => {
    return `<mark>${match}</mark>`;
  });
  return highlightedString;
}
