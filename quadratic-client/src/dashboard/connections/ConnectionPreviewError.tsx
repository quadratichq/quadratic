import { EmptyState } from '@/shared/components/EmptyState';
import { CONTACT_URL } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { Link } from 'react-router';

export function ConnectionPreviewError({
  reloadSchema,
  teamUuid,
  uuid,
  type,
  handleNavigateToEdit,
}: {
  reloadSchema: () => void;
  teamUuid: string;
  uuid: string;
  type: ConnectionType;
  handleNavigateToEdit: () => void;
}) {
  return (
    <div className="mx-auto my-2 flex h-full max-w-md flex-col items-center justify-center gap-2 justify-self-center pb-4 text-center text-sm text-foreground">
      <EmptyState
        isError
        title="Error loading connection schema"
        description="Try reloading the schema. If that doesn’t work, edit the connection details and ensure it’s properly configured. If you still have problems, contact us."
        Icon={ExclamationTriangleIcon}
        actions={
          <div className="flex justify-center gap-2">
            <Button variant="outline" asChild>
              <Link to={CONTACT_URL} target="_blank">
                Contact us
              </Link>
            </Button>
            <Button onClick={handleNavigateToEdit}>Edit connection</Button>
          </div>
        }
      />
    </div>
  );
}
