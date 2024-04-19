import { Type } from '@/shared/components/Type';
import { Button } from '@/shared/shadcn/ui/button';
import { RocketIcon } from '@radix-ui/react-icons';
import { useEffect, useState } from 'react';
import { events } from '../events/events';
import { FixedBottomAlert } from './components/PermissionOverlay';

export const UpdateAlertVersion = () => {
  const [showDialog, setShowDialog] = useState<false | 'recommended' | 'required'>(false);
  useEffect(() => {
    const needRefresh = (refresh: 'required' | 'recommended') => setShowDialog(refresh);
    events.on('needRefresh', needRefresh);
    return () => {
      events.off('needRefresh', needRefresh);
    };
  });

  if (showDialog === false) return null;

  return (
    <FixedBottomAlert>
      <div>
        <RocketIcon className="text-muted-foreground" />
      </div>
      <Type className="flex-grow">
        <strong>App update:</strong> there’s a new version available.
      </Type>
      <div className="flex justify-end gap-2">
        {showDialog === 'recommended' && (
          <Button variant="outline" onClick={() => setShowDialog(false)}>
            Dismiss
          </Button>
        )}
        <Button onClick={() => window.location.reload()}>Refresh</Button>
      </div>
    </FixedBottomAlert>
  );
};
