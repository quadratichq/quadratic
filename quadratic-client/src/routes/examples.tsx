import { sanityClient } from 'quadratic-shared/sanityClient';
import { useLoaderData } from 'react-router-dom';

import { DashboardHeader, DashboardHeaderTitle } from '@/dashboard/components/DashboardHeader';
import type { FilesListExampleFile } from '@/dashboard/components/FilesList';
import { ExampleFilesList } from '@/dashboard/components/FilesList';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { ROUTES } from '@/shared/constants/routes';

export const loader = async () => {
  const examples = await sanityClient.examples.list();
  return { examples };
};

export const Component = () => {
  const { examples } = useLoaderData() as Awaited<ReturnType<typeof loader>>;
  const {
    activeTeam: {
      team: { uuid: activeTeamUuid },
    },
  } = useDashboardRouteLoaderData();

  const files: FilesListExampleFile[] = examples.map(({ name, description, thumbnail, url }) => ({
    description,
    href: ROUTES.CREATE_FILE_EXAMPLE(activeTeamUuid, url, true),
    name,
    thumbnail: thumbnail + '?w=800&h=450&fit=crop&auto=format', // 16/9 aspect ratio
  }));

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
