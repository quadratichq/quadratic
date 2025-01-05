import { Label } from '@/shared/shadcn/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/shadcn/ui/radio-group';
import { cn } from '@/shared/shadcn/utils';
import type { ReactNode} from 'react';
import { useState } from 'react';

export const PrivateFileToggle = ({
  children,
  isPrivate,
  onToggle,
  className,
}: {
  children: ReactNode;
  isPrivate: boolean;
  onToggle: () => void;
  className?: string;
}) => {
  // Make sure the label/checkbox have a unique ID in case there are multiple in the DOM at the same time
  const [id] = useState('private-file-toggle' + new Date().toISOString());

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <p className="text-sm">{children}</p>
      <RadioGroup
        value={isPrivate ? 'private' : 'public'}
        onValueChange={() => onToggle()}
        className="!mb-0 flex items-center gap-3"
      >
        <div className="flex items-center gap-1">
          <RadioGroupItem value={'public'} id={id + 'public'} />
          <Label htmlFor={id + 'public'}>Team files</Label>
        </div>
        <div className="flex items-center gap-1">
          <RadioGroupItem value={'private'} id={id + 'private'} />
          <Label htmlFor={id + 'private'}>My files</Label>
        </div>
      </RadioGroup>
    </div>
  );
};
