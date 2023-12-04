import { ROUTES } from '@/constants/routes';
import { Link } from 'react-router-dom';
import { EXAMPLE_FILES, ExampleFileNames, TYPE } from '../constants/appConstants';
import { DashboardHeader } from './components/DashboardHeader';

export const Component = () => {
  return (
    <>
      <DashboardHeader title="Examples" />

      <div className={`md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3`}>
        {Object.entries(EXAMPLE_FILES).map(([id, { name, description }]) => (
          <Link
            key={id}
            to={ROUTES.CREATE_EXAMPLE_FILE(id as ExampleFileNames)}
            className="flex flex-col border-t border-border py-4 md:border md:px-4 md:py-4 lg:hover:bg-accent"
          >
            <h2 className="text-md truncate">{name}</h2>
            <p className={`${TYPE.caption} text-muted-foreground`}>{description}</p>
          </Link>
        ))}
      </div>
    </>
  );
};
