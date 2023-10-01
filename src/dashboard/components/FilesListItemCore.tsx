import { Public } from '@mui/icons-material';
import { Stack, Typography, useTheme } from '@mui/material';
import { ReactNode } from 'react';
import { FilesListItemInput } from './FilesListItemInput';
import { Layout, ViewPreferences } from './FilesListViewControlsDropdown';

export function FilesListItemCore({
  name,
  description,
  filterValue,
  hasNetworkError,
  isRenaming,
  isShared,
  renameFile,
  viewPreferences,
  actions,
}: {
  name: string;
  description: string;
  filterValue: string;
  hasNetworkError: boolean;
  isRenaming: boolean;
  isShared: boolean;
  renameFile: Function;
  viewPreferences: ViewPreferences;
  actions?: ReactNode;
}) {
  const theme = useTheme();
  const __html = filterValue ? highlightMatchingString(name, filterValue) : name;

  return (
    <Stack direction="row" alignItems="center" gap={theme.spacing(1)}>
      <Stack sx={{ position: 'relative', mr: 'auto', minWidth: '0', flexGrow: '2' }}>
        <Typography
          variant={viewPreferences.layout === Layout.List ? 'body1' : 'body2'}
          color="text.primary"
          noWrap
          dangerouslySetInnerHTML={{ __html }}
        />

        {hasNetworkError ? (
          <Typography variant="caption" color="error">
            Failed to sync changes
          </Typography>
        ) : (
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{
              '& > *:not(:last-child):after': { content: '"·"', mx: theme.spacing(0.5) },
            }}
          >
            {isShared && (
              <span>
                <Public fontSize="inherit" sx={{ position: 'relative', top: '2px' }} /> Public
              </span>
            )}
            <span>{description}</span>
          </Typography>
        )}

        {isRenaming && <FilesListItemInput setValue={renameFile} value={name} />}
      </Stack>
      {actions}
    </Stack>
  );
}

function highlightMatchingString(inputString: string, searchString: string) {
  const regex = new RegExp(searchString, 'gi'); // case insensitive matching
  const highlightedString = inputString.replace(regex, (match: string) => {
    return `<mark>${match}</mark>`;
  });
  return highlightedString;
}
