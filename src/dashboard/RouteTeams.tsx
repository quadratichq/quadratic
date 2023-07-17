import PaneHeader from './PaneHeader';
import Empty from './Empty';
import { AccessTimeOutlined } from '@mui/icons-material';
import { Button } from '@mui/material';

export const Component = () => {
  // const data = useLoaderData() as LoaderData;
  // const theme = useTheme();
  return (
    <>
      <PaneHeader title="My team" />
      <Empty
        title="Coming soon"
        description="Teams are a space to invite others and collaborate together. Interested? Sign up for the beta for early access."
        Icon={AccessTimeOutlined}
        actions={<Button variant="outlined">Sign up for the beta</Button>}
      />
    </>
  );
};
