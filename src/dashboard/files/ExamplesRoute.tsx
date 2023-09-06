import { Divider } from '@mui/material';
import { EXAMPLE_FILES } from '../../constants/appConstants';
import { ROUTES } from '../../constants/routes';
import { DashboardFileLink } from '../components/DashboardFileLink';
import { DashboardHeader } from '../components/DashboardHeader';

export const Component = () => {
  return (
    <>
      <DashboardHeader title="Examples" />
      {Object.entries(EXAMPLE_FILES).map(([id, { name, description }]) => (
        <>
          <DashboardFileLink
            key={id}
            name={name}
            description={description}
            to={`${ROUTES.CREATE_FILE}?example=${id}`}
          />
          <Divider />
        </>
      ))}
    </>
  );
};
