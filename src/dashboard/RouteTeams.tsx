import PaneHeader from './PaneHeader';
import Empty from './Empty';
import { PeopleOutline } from '@mui/icons-material';
import { Button } from '@mui/material';

export const Component = () => {
  // const data = useLoaderData() as LoaderData;
  // const theme = useTheme();
  return (
    <>
      <PaneHeader title="Coming soon" />
      <Empty
        title="Teams"
        description="A space to share files and collaborate with others. Interested? Sign up for early access to Teams."
        Icon={PeopleOutline}
        actions={<Button variant="outlined">Sign up for the beta</Button>}
      />
    </>
  );
};
