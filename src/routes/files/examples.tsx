import { EXAMPLE_FILES } from 'constants/app';
import { ROUTES } from 'constants/routes';
import { Link } from 'react-router-dom';
import File from 'shared/dashboard/FileListItem';
import Header from 'shared/dashboard/Header';

export const Component = () => {
  return (
    <>
      <Header title="Examples" />
      {Object.entries(EXAMPLE_FILES).map(([id, { name, description }]) => (
        <Link to={`${ROUTES.CREATE_FILE}?example=${id}`} style={{ textDecoration: 'none' }} key={id}>
          <File name={name} description={description} />
        </Link>
      ))}
    </>
  );
};
