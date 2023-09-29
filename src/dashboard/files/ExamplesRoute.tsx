import { EXAMPLE_FILES } from '../../constants/appConstants';
import { DashboardHeader } from '../components/DashboardHeader';
import { FilesList } from '../components/FilesList';

const files = Object.entries(EXAMPLE_FILES).map(([id, { name, description }]) => ({
  name,
  uuid: id,
  description,
  created_date: '',
  updated_date: '',
  public_link_access: 'NOT_SHARED',
}));

export const Component = () => {
  return (
    <>
      <DashboardHeader title="Examples" />

      <FilesList
        // TODO refine the list view if we keep examples as-is
        // @ts-expect-error
        files={files}
      />
    </>
  );
};
