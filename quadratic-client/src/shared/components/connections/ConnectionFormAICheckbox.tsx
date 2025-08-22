import { Checkbox } from '@/shared/shadcn/ui/checkbox';
import { Label } from '@/shared/shadcn/ui/label';
import { cn } from '@/shared/shadcn/utils';

export function ConnectionFormAICheckbox({
  value,
  setValue,
  showError,
}: {
  value: boolean;
  setValue: (value: boolean) => void;
  showError: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-row items-start gap-2 rounded-md border border-border p-3 shadow-sm">
        <Checkbox
          id="ai-checkbox"
          className="mt-0.5"
          checked={value}
          onCheckedChange={(checked) => setValue(!!checked)}
        />
        <Label
          htmlFor="ai-checkbox"
          className={cn('flex flex-col font-normal leading-5', showError && 'text-destructive')}
        >
          The credentials I'm using are read-only. I acknowledge connecting credentials with write permissions can
          result in data being overwritten in my data source.
        </Label>
      </div>
      {showError && <p className="text-xs font-medium text-destructive">Required</p>}
    </div>
  );
}
