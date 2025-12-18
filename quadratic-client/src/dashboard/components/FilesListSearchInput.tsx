import { CloseIcon, SearchIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';

export function FilesListSearchInput({
  value,
  onChange,
  className,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn(`relative w-48`, className)}>
      <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground opacity-30" />
      <Input
        onChange={(e) => onChange(e.target.value)}
        value={value}
        placeholder="Search…"
        className="w-full pl-8"
        disabled={disabled}
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 text-muted-foreground hover:bg-transparent"
          onClick={() => onChange('')}
          aria-label="Clear filter"
        >
          <CloseIcon />
        </Button>
      )}
    </div>
  );
}
