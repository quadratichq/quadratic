import { ExampleFilesList, FilesListExampleFile } from '@/dashboard/components/FilesList';
import { ROUTES } from '@/shared/constants/routes';
import { sanityClient } from 'quadratic-shared/sanityClient';
import { useLoaderData } from 'react-router-dom';
import { DashboardHeader, DashboardHeaderTitle } from '../dashboard/components/DashboardHeader';

export const loader = async () => {
  const examples = await sanityClient.examples.list();
  const files: FilesListExampleFile[] = examples.map(({ name, description, thumbnail, url }, i) => ({
    description,
    href: ROUTES.CREATE_FILE_EXAMPLE(url),
    name,
    thumbnail: thumbnail + '?w=800&h=450&fit=crop&auto=format', // 16/9 aspect ratio
  }));
  return { files };
};

export const Component = () => {
  const { files } = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  return (
    <>
      <DashboardHeader
        title="Examples"
        titleNode={<DashboardHeaderTitle>Example files by the Quadratic team</DashboardHeaderTitle>}
      />

      <ExampleFilesList files={files} />
    </>
  );
};
