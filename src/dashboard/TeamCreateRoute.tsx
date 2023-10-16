import { Box, Button, Stack, useTheme } from '@mui/material';
import { DashboardHeader } from './components/DashboardHeader';
import { TeamEdit } from './components/TeamEdit';

export const Component = () => {
  const theme = useTheme();

  return (
    <>
      <DashboardHeader title="Create team" />
      <Stack gap={theme.spacing(4)} mt={theme.spacing(4)}>
        <TeamEdit />
        <Box>
          <Button variant="contained" disableElevation>
            Create team
          </Button>
        </Box>
      </Stack>
    </>
  );
};
