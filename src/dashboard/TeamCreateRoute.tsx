import { Box, Button, Stack, useTheme } from '@mui/material';
import { apiClient } from '../api/apiClient';
import { DashboardHeader } from './components/DashboardHeader';
import { TeamEdit } from './components/TeamEdit';

export const Component = () => {
  const theme = useTheme();
  // const navigate = useNavigate();

  return (
    <>
      <DashboardHeader title="Create team" />
      <Stack gap={theme.spacing(4)} mt={theme.spacing(4)}>
        <TeamEdit />
        <Box>
          <Button
            variant="contained"
            disableElevation
            onClick={async () => {
              // TODO use form submit that navigates to the new team
              await apiClient.createTeam({ name: 'Test team' });
              // navigate('/teams/2?dialog=share');
            }}
          >
            Create team
          </Button>
        </Box>
      </Stack>
    </>
  );
};
