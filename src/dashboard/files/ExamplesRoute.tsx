import { EXAMPLE_FILES } from 'constants/app';
import { ROUTES } from 'constants/routes';
import { FileListItem } from 'dashboard/components/FileListItem';
import { Header } from 'dashboard/components/Header';
import { Link } from 'react-router-dom';

export const Component = () => {
  return (
    <>
      <Header title="Examples" />
      {Object.entries(EXAMPLE_FILES).map(([id, { name, description }]) => (
        <Link to={`${ROUTES.CREATE_FILE}?example=${id}`} style={{ textDecoration: 'none' }} key={id}>
          <FileListItem name={name} description={description} />
        </Link>
      ))}
    </>
  );
};
