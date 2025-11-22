import { DOCUMENTATION_CONNECTIONS_DATABASE_ACCESS_URL } from '@/shared/constants/urls';
import { FormDescription } from '@/shared/shadcn/ui/form';

export function ConnectionFormCredentialsHelper() {
  return (
    <FormDescription>
      We recommend using read only credentials within Quadratic.{' '}
      <a
        href={DOCUMENTATION_CONNECTIONS_DATABASE_ACCESS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-primary"
      >
        Learn more
      </a>
    </FormDescription>
  );
}
