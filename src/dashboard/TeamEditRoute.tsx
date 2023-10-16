import { Stack, useTheme } from '@mui/material';
import { useLoaderData } from 'react-router-dom';
import { ApiTypes } from '../api/types';
import { DashboardHeader } from './components/DashboardHeader';
import { TeamEdit } from './components/TeamEdit';
import { data } from './team-1-mock-data';

export const loader = async () => {
  return data;
};

export const Component = () => {
  const theme = useTheme();
  const data = useLoaderData() as ApiTypes['/v0/teams/:uuid.GET.response'];

  return (
    <>
      <DashboardHeader title="Edit team" />
      <Stack gap={theme.spacing(4)} mt={theme.spacing(4)}>
        <TeamEdit data={data} />
      </Stack>
    </>
  );
};
