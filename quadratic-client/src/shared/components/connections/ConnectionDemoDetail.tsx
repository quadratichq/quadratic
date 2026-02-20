import { getToggleShowConnectionDemoAction } from '@/routes/api.connections';
import { useConfirmDialog } from '@/shared/components/ConfirmProvider';
import { Button } from '@/shared/shadcn/ui/button';
import { useSubmit } from 'react-router';

export function ConnectionDemoDetail({ teamUuid, onClose }: { teamUuid: string; onClose: () => void }) {
  const submit = useSubmit();
  const confirmFn = useConfirmDialog('deleteDemoConnection', undefined);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        This connection is provided by the Quadratic team for educational purposes. You can remove it if you don’t want
        see it in your list of connections.
      </p>
      <div className="flex justify-between">
        <Button
          variant="outline-destructive"
          onClick={async () => {
            if (await confirmFn()) {
              const { json, options } = getToggleShowConnectionDemoAction(teamUuid, false);
              submit(json, { ...options, navigate: false });
              onClose();
            }
          }}
        >
          Remove
        </Button>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
