import { Box, Stack, TextField, useMediaQuery, useTheme } from '@mui/material';
import { FileListViewControlsDropdown } from './FilesListViewControlsDropdown';
import { FilesListViewControlsLayoutToggle } from './FilesListViewControlsLayoutToggle';

export function FilesListViewControls({ filterValue, setFilterValue, viewPreferences, setViewPreferences }: any) {
  const theme = useTheme();
  const showToggle = useMediaQuery(theme.breakpoints.up('sm'));

  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      gap={theme.spacing(2)}
      sx={{
        py: theme.spacing(1.5),

        [theme.breakpoints.up('md')]: {
          px: theme.spacing(),
        },
      }}
    >
      <Box sx={{ maxWidth: '25rem', flexGrow: 2 }}>
        <TextField
          onChange={(e) => setFilterValue(e.target.value)}
          value={filterValue}
          size="small"
          placeholder="Filter by name…"
          fullWidth
        />
      </Box>
      <Stack direction="row" gap={theme.spacing(2)} alignItems="center">
        <Box sx={{ color: theme.palette.text.secondary }}>
          <FileListViewControlsDropdown
            showToggle={showToggle}
            viewPreferences={viewPreferences}
            setViewPreferences={setViewPreferences}
          />
        </Box>

        {showToggle && (
          <Box>
            <FilesListViewControlsLayoutToggle
              viewPreferences={viewPreferences}
              setViewPreferences={setViewPreferences}
            />
          </Box>
        )}
      </Stack>
    </Stack>
  );
}
