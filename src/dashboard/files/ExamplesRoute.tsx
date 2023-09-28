import { Box, Divider } from '@mui/material';
import { EXAMPLE_FILES } from '../../constants/appConstants';
import { DashboardFileLink } from '../components/DashboardFileLink';
import { DashboardHeader } from '../components/DashboardHeader';

export const Component = () => {
  return (
    <>
      <DashboardHeader title="Examples" />
      {Object.entries(EXAMPLE_FILES).map(([id, { name, description }]) => (
        <Box key={id}>
          <DashboardFileLink key={id} name={name} description={description} />
          <Divider />
        </Box>
      ))}
    </>
  );
};
