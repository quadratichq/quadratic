import { EmptyPage } from '@/shared/components/Empty';
import { SUPPORT_EMAIL } from '@/shared/constants/appConstants';
import { Button } from '@/shared/shadcn/ui/button';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { Link } from 'react-router';

export const Component = () => (
  <EmptyPage
    title="404: not found"
    description={
      <>
        Check the URL and try again. Or, contact us for help at{' '}
        <a href={SUPPORT_EMAIL} className="underline">
          {SUPPORT_EMAIL}
        </a>
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
