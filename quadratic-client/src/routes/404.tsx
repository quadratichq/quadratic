import { EmptyPage } from '@/shared/components/EmptyPage';
import { CONTACT_URL } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { Link } from 'react-router';

export const Component = () => (
  <EmptyPage
    title="404: not found"
    description="Check the URL and try again."
    Icon={ExclamationTriangleIcon}
    actions={
      <div className="flex items-center gap-2">
        <Button asChild variant="secondary">
          <Link to={CONTACT_URL} target="_blank">
            Contact us
          </Link>
        </Button>
        <Button asChild>
          <Link to="/">Go home</Link>
        </Button>
      </div>
    }
  />
);
