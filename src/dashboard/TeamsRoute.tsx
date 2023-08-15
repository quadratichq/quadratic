import { PeopleOutline } from '@mui/icons-material';
import { Empty } from '../components/Empty';
import { Header } from '../dashboard/components/Header';

export const Component = () => {
  const mailto =
    'mailto:support@quadratichq.com?subject=Early%20access%20to%20teams&body=Please%20sign%20me%20up%20for%20early%20access%20to%20teams!';
  return (
    <>
      <Header title="My team" />
      <Empty
        title="Coming soon"
        description={
          <>
            Quadratic Teams is a collaborative space where your team can work on files together. If you are interested
            in being the first to use teams, contact us at <a href={mailto}>support@quadratichq.com</a>
          </>
        }
        Icon={PeopleOutline}
      />
    </>
  );
};
