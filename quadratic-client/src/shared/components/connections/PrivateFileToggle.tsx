import { Switch } from '@/shared/shadcn/ui/switch';
import { cn } from '@/shared/shadcn/utils';
import { ReactNode, useState } from 'react';

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
    <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <Switch checked={isPrivate} onCheckedChange={onToggle} id={id} />
      <label htmlFor={id}>{children}</label>
    </div>
  );
};
