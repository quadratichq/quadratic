import { Public } from '@mui/icons-material';
import { Box, Stack, Typography, useTheme } from '@mui/material';
import { ReactNode } from 'react';
import { FileListItemInput } from './FileListItemInput';

type Props = {
  name: string;
  description: string;
  isShared: boolean;
  actions?: ReactNode;
  hasNetworkError?: boolean;
  filterValue?: string;
  // TODO make required
  isRenaming?: boolean;
  renameFile?: Function;
};

DashboardFileLink.defaultProps = {
  isShared: false,
};

export function DashboardFileLink({
  name,
  description,
  hasNetworkError,
  actions,
  isShared,
  filterValue,
  isRenaming,
  renameFile,
}: Props) {
  const theme = useTheme();

  const __html = filterValue ? highlightMatchingString(name, filterValue) : name;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1),
        px: theme.spacing(1),
        py: theme.spacing(1.5),

        [theme.breakpoints.down('md')]: {
          px: 0,
        },
      }}
    >
      <Stack sx={{ position: 'relative', mr: 'auto', minWidth: '0' }}>
        <Typography variant="body1" color="text.primary" noWrap dangerouslySetInnerHTML={{ __html }} />

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

        {isRenaming && (
          // @ts-expect-error
          <FileListItemInput setValue={renameFile} value={name} />
        )}
      </Stack>
      {actions}
    </Box>
  );
}

function highlightMatchingString(inputString: string, searchString: string) {
  const regex = new RegExp(searchString, 'gi'); // case insensitive matching
  const highlightedString = inputString.replace(regex, (match: string) => {
    return `<mark>${match}</mark>`;
  });
  return highlightedString;
}
