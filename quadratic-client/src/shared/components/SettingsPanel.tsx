import { Label } from '@/shared/shadcn/ui/label';
import { Switch } from '@/shared/shadcn/ui/switch';
import { cn } from '@/shared/shadcn/utils';
import { ReactNode, useId } from 'react';

/**
 * Component that renders a setting panel (a label, description, and a switch)
 * Optionally may include a "body" (for example, when enabled it shows additional
 * informational content).
 */
type SettingPanelProps = {
  label: string;
  description: string | ReactNode;
  onCheckedChange: (checked: boolean) => void;
  checked: boolean;
  children?: ReactNode;
  isNested?: boolean;
  className?: string;
};

export function SettingPanel({
  label,
  description,
  onCheckedChange,
  checked,
  children,
  isNested,
  className,
}: SettingPanelProps) {
  const reactId = useId();
  const id = `setting-panel-${reactId}`;

  return (
    <div className={cn('space-y-3 rounded-lg border p-3 shadow-sm', className)}>
      <div className="flex w-full flex-row items-center justify-between gap-3">
        <div className="mr-auto space-y-0.5 text-sm">
          <Label htmlFor={id} className="font-semibold">
            {label}
          </Label>
          <p className="text-muted-foreground">{description}</p>
        </div>

        <Switch
          id={id}
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
