import { Label } from '@/shared/shadcn/ui/label';
import { Switch } from '@/shared/shadcn/ui/switch';
import { cn } from '@/shared/shadcn/utils';
import type { ReactNode } from 'react';
import { useId } from 'react';

/**
 * Component that renders a preference control (a label, description, and a switch)

 */
export function SettingControl({
  label,
  description,
  onCheckedChange,
  checked,
  children,
  className,
  disabled,
}: {
  label: string;
  description: string | ReactNode;
  onCheckedChange: (checked: boolean) => void;
  checked: boolean;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const reactId = useId();
  const id = `setting-panel-${reactId}`;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex w-full flex-row items-center justify-between gap-4">
        <div className="mr-auto text-sm">
          <Label htmlFor={id} className="font-medium">
            {label}
          </Label>
          <p className="text-muted-foreground">{description}</p>
        </div>

        <Switch
          id={id}
          disabled={disabled}
          checked={checked}
          onCheckedChange={(checked) => {
            onCheckedChange(checked);
          }}
        />
      </div>
      {children}
    </div>
  );
}
