import { Link } from 'react-router-dom';
import { EXAMPLE_FILES } from '../../constants/appConstants';
import { ROUTES } from '../../constants/routes';
import { DashboardFileListItem } from '../components/DashboardFileListItem';
import { DashboardHeader } from '../components/DashboardHeader';

export const Component = () => {
  return (
    <>
      <DashboardHeader title="Examples" />
      {Object.entries(EXAMPLE_FILES).map(([id, { name, description }]) => (
        <Link to={`${ROUTES.CREATE_FILE}?example=${id}`} style={{ textDecoration: 'none' }} key={id}>
          <DashboardFileListItem name={name} description={description} />
        </Link>
      ))}
    </>
  );
};
