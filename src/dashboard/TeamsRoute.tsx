import { StopwatchIcon } from '@radix-ui/react-icons';
import { Empty } from '../components/Empty';
import { SUPPORT_EMAIL } from '../constants/appConstants';
import { DashboardHeader } from './components/DashboardHeader';

export const Component = () => {
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=Early%20access%20to%20teams&body=Please%20sign%20me%20up%20for%20early%20access%20to%20teams!`;
  return (
    <>
      <DashboardHeader title="My team" />
      <Empty
        title="Coming soon"
        description={
          <>
            Quadratic Teams is a collaborative space where your team can work on files together. If you are interested
            in being the first to use teams, contact us at <a href={mailto}>{SUPPORT_EMAIL}</a>
          </>
        }
        Icon={StopwatchIcon}
      />
    </>
  );
};
