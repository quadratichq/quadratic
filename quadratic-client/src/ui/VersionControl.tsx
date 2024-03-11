import { Type } from '@/components/Type';
import { Button } from '@/shadcn/ui/button';
import { RocketIcon } from '@radix-ui/react-icons';
import { useEffect, useState } from 'react';
import { FixedBottomAlert } from './components/PermissionOverlay';

export const VersionControlAlert = () => {
  const [showDialog, setShowDialog] = useState<false | 'recommended' | 'required'>(false);
  useEffect(() => {
    const needRefresh = (message: any /* { detail: 'required' | 'recommended' } */) => setShowDialog(message.detail);
    window.addEventListener('need-refresh', needRefresh);
    return () => {
      window.removeEventListener('need-refresh', needRefresh);
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
