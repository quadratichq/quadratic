import { DashboardHeader, DashboardHeaderTitle } from '@/dashboard/components/DashboardHeader';
import { ExampleFilesList, type ExampleFilesListFile } from '@/dashboard/components/ExampleFilesList';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { ROUTES } from '@/shared/constants/routes';
import { sanityClient } from 'quadratic-shared/sanityClient';
import { useLoaderData } from 'react-router';

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

  const files: ExampleFilesListFile[] = examples.map(({ name, description, thumbnail, url }, i) => ({
    description,
    href: ROUTES.CREATE_FILE_FROM_TEMPLATE({
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
        title="Templates"
        titleNode={<DashboardHeaderTitle>Templates by the Quadratic team</DashboardHeaderTitle>}
      />

      <ExampleFilesList files={files} />
    </>
  );
};
