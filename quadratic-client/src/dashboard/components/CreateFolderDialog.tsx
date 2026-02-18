import { apiClient } from '@/shared/api/apiClient';
import { Button } from '@/shared/shadcn/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/shadcn/ui/dialog';
import { Input } from '@/shared/shadcn/ui/input';
import { useState } from 'react';
import { useRevalidator } from 'react-router';

export function CreateFolderDialog({
  teamUuid,
  parentFolderUuid,
  isPrivate,
  onClose,
}: {
  teamUuid: string;
  parentFolderUuid?: string;
  isPrivate?: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revalidator = useRevalidator();

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Folder name is required.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await apiClient.folders.create({
        name: name.trim(),
        teamUuid,
        parentFolderUuid,
        isPrivate,
      });
      revalidator.revalidate();
      onClose();
    } catch {
      setError('Failed to create folder. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
          <DialogDescription>Create a new folder to organize your files.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Input
            autoFocus
            placeholder="Folder name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isLoading} loading={isLoading}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
