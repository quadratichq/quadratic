import { PeopleOutline } from '@mui/icons-material';
import { Button } from '@mui/material';
import Empty from '../shared/Empty';
import Header from '../shared/dashboard/Header';

export const Component = () => {
  const mailto =
    'mailto:support@quadratichq.com?subject=Early%20access%20to%20teams&body=Please%20sign%20me%20up%20for%20early%20access%20to%20teams!';
  return (
    <>
      <Header title="Teams" />
      <Empty
        title="Coming soon…"
        description={
          <>Teams will be a collaborative space where you can invite other people and work on files together.</>
        }
        Icon={PeopleOutline}
        actions={
          <Button href={mailto} variant="contained" disableElevation>
            Email us for early access
          </Button>
        }
      />
    </>
  );
};
