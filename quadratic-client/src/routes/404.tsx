import { Empty } from '@/dashboard/components/Empty';
import { SUPPORT_EMAIL } from '@/shared/constants/appConstants';
import { Button } from '@/shared/shadcn/ui/button';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { Link } from 'react-router-dom';

export const Component = () => (
  <Empty
    title="404: not found"
    description={
      <>
        Check the URL and try again. Or, contact us for help at <a href={SUPPORT_EMAIL}>{SUPPORT_EMAIL}</a>
      </>
    }
    Icon={ExclamationTriangleIcon}
    actions={
      <Button asChild variant="secondary">
        <Link to="/">Go home</Link>
      </Button>
    }
  />
);
