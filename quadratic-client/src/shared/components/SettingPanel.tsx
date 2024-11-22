import { Label } from '@/shared/shadcn/ui/label';
import { Switch } from '@/shared/shadcn/ui/switch';
import { ReactNode, useId } from 'react';

/**
 * Component that renders a setting panel (a label, description, and a switch)
 * Optionally may include a "body" (for example, when enabled it shows additional
 * informational content).
 */
export function SettingPanel({
  label,
  description,
  onCheckedChange,
  checked,
  children,
}: {
  label: string;
  description: string | ReactNode;
  onCheckedChange: (checked: boolean) => void;
  checked: boolean;
  children?: ReactNode;
}) {
  const reactId = useId();
  const id = `setting-panel-${reactId}`;
  return (
    <div className="space-y-3 rounded-lg border p-3 shadow-sm">
      <div className="flex w-full flex-row items-center justify-between gap-3">
        <div className="mr-auto space-y-0.5 text-sm">
          <Label htmlFor={id} className="font-medium">
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
