import { sanityClient } from '@/api/sanityClient';
import { ROUTES } from '@/constants/routes';
import { FilesList, FilesListFile } from '@/dashboard/components/FilesList';
import { useLoaderData } from 'react-router-dom';
import { DashboardHeader, DashboardHeaderTitle } from '../dashboard/components/DashboardHeader';

export const loader = async () => {
  const examples = await sanityClient.getExamples();
  const files: FilesListFile[] = examples.map(({ name, slug, thumbnail, url, _updatedAt, _createdAt }, i) => ({
    href: ROUTES.EXAMPLE(slug),
    name,
    createdDate: _createdAt,
    updatedDate: _updatedAt,
    // 16/9 aspect ratio
    thumbnail: thumbnail + '?w=800&h=450&fit=crop&auto=format',
  }));
  return { examples, files };
};

export const Component = () => {
  const { files } = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  return (
    <>
      <DashboardHeader
        title="Examples"
        titleNode={
          <DashboardHeaderTitle>
            Examples{' '}
            <span className="text-base font-normal text-muted-foreground">(maintained by the Quadratic team)</span>
          </DashboardHeaderTitle>
        }
      />

      <FilesList files={files} />
    </>
  );
};
