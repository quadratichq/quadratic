import { FormatAlignCenterIcon, FormatAlignLeftIcon, FormatAlignRightIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';

export const FormattingBar = () => {
  return (
    <TooltipProvider>
      <div className="flex flex-grow items-center justify-center border-l border-r text-sm">
        <Item>
          <FormatAlignLeftIcon />
        </Item>
        <Item>
          <FormatAlignCenterIcon />
        </Item>
        <Item>
          <FormatAlignRightIcon />
        </Item>
      </div>
    </TooltipProvider>
  );
};

function Item({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Button variant="ghost" size="icon">
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>Align right</p>
      </TooltipContent>
    </Tooltip>
  );
}
