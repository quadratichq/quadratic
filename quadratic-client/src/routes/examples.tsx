import type { FilesListExampleFile } from '@/dashboard/components/FilesList';
import { ExampleFilesList } from '@/dashboard/components/FilesList';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { ROUTES } from '@/shared/constants/routes';
import { sanityClient } from 'quadratic-shared/sanityClient';
import { useLoaderData } from 'react-router';
import { DashboardHeader, DashboardHeaderTitle } from '../dashboard/components/DashboardHeader';

export const loader = async () => {
  const examples = await sanityClient.examples.list();
  return { examples };
};

export const Component = () => {
  const { examples } = useLoaderData<typeof loader>();
  const {
    activeTeam: {
      team: { uuid: activeTeamUuid },
    },
  } = useDashboardRouteLoaderData();

  const files: FilesListExampleFile[] = examples.map(({ name, description, thumbnail, url }, i) => ({
    description,
    href: ROUTES.CREATE_FILE_EXAMPLE({
      teamUuid: activeTeamUuid,
      publicFileUrlInProduction: url,
      additionalParams: '',
    }),
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
