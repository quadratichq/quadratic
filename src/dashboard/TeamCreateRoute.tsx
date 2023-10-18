import { Box, Button, Stack, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { DashboardHeader } from './components/DashboardHeader';
import { TeamEdit } from './components/TeamEdit';

export const Component = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <>
      <DashboardHeader title="Create team" />
      <Stack gap={theme.spacing(4)} mt={theme.spacing(4)}>
        <TeamEdit />
        <Box>
          <Button
            variant="contained"
            disableElevation
            onClick={() => {
              navigate('/teams/2?dialog=share');
            }}
          >
            Create team
          </Button>
        </Box>
      </Stack>
    </>
  );
};
