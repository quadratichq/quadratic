import PaneHeader from './PaneHeader';
import { EXAMPLE_FILES } from '../constants/app';
import File from './File';

export const Component = () => {
  // const data = useLoaderData() as LoaderData;
  // const theme = useTheme();
  return (
    <>
      <PaneHeader title="Example files" />
      {EXAMPLE_FILES.map(({ name, description, file }) => (
        <File key={file} name={name} description={description} to={`/file?file=${file}`} />
      ))}
    </>
  );
};
