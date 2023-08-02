import { PeopleOutline } from '@mui/icons-material';
import { Button } from '@mui/material';
import Empty from '../shared/Empty';
import Header from '../shared/dashboard/Header';

export const Component = () => {
  // TODO what happens when you click the button
  return (
    <>
      <Header title="Teams" />
      <Empty
        title="Coming soon…"
        description="Teams is a collaborative space to work on files with other people. Interested? Sign up for early access."
        Icon={PeopleOutline}
        actions={
          <Button variant="contained" disableElevation>
            Sign up for the beta
          </Button>
        }
      />
    </>
  );
};
