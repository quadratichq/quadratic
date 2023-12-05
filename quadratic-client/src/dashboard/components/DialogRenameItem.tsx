import { Button } from '@/shadcn/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shadcn/ui/dialog';
import { Input } from '@/shadcn/ui/input';
import { useState } from 'react';

export function DialogRenameItem({
  itemLabel,
  onClose,
  onSave,
  value,
}: {
  itemLabel: string;
  onClose: () => void;
  onSave: (newValue: string) => void;
  value: string;
}) {
  const [localValue, setLocalValue] = useState<string>(value);

  const count = localValue.length;
  // TODO: one day set a max length on file/team name
  const disabled = count === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Don't do anything if we're disabled
    if (disabled) {
      return;
    }

    // Don't do anything if the name didn't change
    if (localValue === value) {
      onClose();
      return;
    }

    // TODO: value-specific validation, don't allow empty values

    onSave(localValue);
    onClose();
  };

  const handleInputChange = (e: React.FormEvent<HTMLInputElement>) => {
    const newValue = e.currentTarget.value;
    setLocalValue(newValue);
  };

  const formId = 'rename-item';
  const inputId = 'rename-item-input';

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle asChild>
            <label htmlFor={inputId}>Rename {itemLabel.toLowerCase()}</label>
          </DialogTitle>
          <DialogDescription>{value}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} id={formId}>
          <Input id={inputId} value={localValue} autoComplete="off" onChange={handleInputChange} />
          {/* <p className={`text-right text-sm ${disabled ? 'text-destructive' : 'text-muted-foreground'}`}>
            {count} / {FILE_AND_TEAM_NAME_MAX_LENGTH}
          </p> */}
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>

          <Button disabled={disabled} type="submit" form={formId}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
