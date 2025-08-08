import { ArrowSouthIcon, CloseIcon, LightedBulbIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/shared/shadcn/ui/popover';
import { memo } from 'react';

interface DidYouKnowPopoverProps {
  children: React.ReactNode;
  description: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  title: string;
}
export const DidYouKnowPopover = memo(({ children, description, open, setOpen, title }: DidYouKnowPopoverProps) => {
  // TODO: as we begin to use this component elsewhere, we'll likely need a
  // a prop to indicate on which side we want to show the arrow.
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor>{children}</PopoverAnchor>
      <PopoverContent side="bottom" align="center" className="flex w-64 flex-col items-center rounded">
        <Button variant="ghost" size="icon-sm" className="absolute right-2 top-2" onClick={() => setOpen(false)}>
          <CloseIcon className="text-muted-foreground" />
        </Button>
        <LightedBulbIcon className="my-2 text-primary" size="lg" />
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Did you know?</p>
        <h3 className="mt-1 text-base font-semibold text-foreground">{title}</h3>
        <p className="text-center text-sm">{description}</p>
        <ArrowSouthIcon className="mt-2 text-muted-foreground opacity-20" size="lg" />
      </PopoverContent>
    </Popover>
  );
});
