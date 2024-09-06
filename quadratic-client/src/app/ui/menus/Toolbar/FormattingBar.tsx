import { editRedo, editUndo } from '@/app/actions/edit';
import {
  formatAlignHorizontalCenter,
  formatAlignHorizontalLeft,
  formatAlignHorizontalRight,
  formatAlignVerticalBottom,
  formatAlignVerticalMiddle,
  formatAlignVerticalTop,
  formatBold,
  formatClear,
  formatItalic,
  formatNumberAutomatic,
  formatNumberCurrency,
  formatNumberDecimalDecrease,
  formatNumberDecimalIncrease,
  formatNumberPercent,
  formatNumberScientific,
  formatNumberToggleCommas,
  formatTextWrappingClip,
  formatTextWrappingOverflow,
  formatTextWrappingWrap,
} from '@/app/actions/format';
import {
  ArrowDropDownIcon,
  BorderAllIcon,
  FormatColorFillIcon,
  FormatColorTextIcon,
  Number123Icon,
} from '@/shared/components/Icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { ReactNode } from 'react';

export const FormattingBar = () => {
  return (
    <TooltipProvider>
      <div className="flex flex-grow items-stretch justify-center text-sm">
        <FormatButton action={editUndo} />
        <FormatButton action={editRedo} />
        <Separator />
        <FormatButton action={formatNumberCurrency} />
        <FormatButton action={formatNumberPercent} />
        <FormatButton action={formatNumberDecimalDecrease} />
        <FormatButton action={formatNumberDecimalIncrease} />
        <FormatButtonDropdown showDropdownArrow tooltipLabel="More number formats" Icon={Number123Icon}>
          <FormatButtonDropdownActions
            actions={[formatNumberAutomatic, formatNumberScientific, formatNumberToggleCommas]}
          />
        </FormatButtonDropdown>

        <Separator />

        <FormatButton action={formatBold} />
        <FormatButton action={formatItalic} />
        <FormatButtonDropdown tooltipLabel="Text color" Icon={FormatColorTextIcon}>
          <DropdownMenuItem>TODO color picker</DropdownMenuItem>
        </FormatButtonDropdown>

        <Separator />

        <FormatButtonDropdown tooltipLabel="Fill color" Icon={FormatColorFillIcon}>
          <DropdownMenuItem>TODO color picker</DropdownMenuItem>
        </FormatButtonDropdown>
        <FormatButtonDropdown tooltipLabel="Borders" Icon={BorderAllIcon}>
          <DropdownMenuItem>TODO border picker</DropdownMenuItem>
        </FormatButtonDropdown>

        <Separator />

        {/* TODO: (jimniels) make these icons match the current selection */}
        <FormatButtonDropdown showDropdownArrow tooltipLabel="Horizontal align" Icon={formatAlignHorizontalLeft.Icon}>
          <FormatButtonDropdownActions
            actions={[formatAlignHorizontalLeft, formatAlignHorizontalCenter, formatAlignHorizontalRight]}
          />
        </FormatButtonDropdown>
        <FormatButtonDropdown showDropdownArrow tooltipLabel="Vertical align" Icon={formatAlignVerticalTop.Icon}>
          <FormatButtonDropdownActions
            actions={[formatAlignVerticalTop, formatAlignVerticalMiddle, formatAlignVerticalBottom]}
          />
        </FormatButtonDropdown>
        <FormatButtonDropdown showDropdownArrow tooltipLabel="Text wrap" Icon={formatTextWrappingWrap.Icon}>
          <FormatButtonDropdownActions
            actions={[formatTextWrappingWrap, formatTextWrappingOverflow, formatTextWrappingClip]}
          />
        </FormatButtonDropdown>

        <Separator />

        <FormatButton action={formatClear} />
      </div>
    </TooltipProvider>
  );
};

function Separator() {
  return <hr className="relative mx-1.5 mt-1.5 h-2/3 w-[1px] bg-border" />;
}

function FormatButtonDropdown({
  Icon,
  tooltipLabel,
  children,
  showDropdownArrow,
}: {
  Icon: any;
  children: ReactNode;
  tooltipLabel: string;
  showDropdownArrow?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="data-[state=open]:bg-accent">
        <Tooltip>
          <TooltipTrigger className="flex h-full items-center px-2 hover:bg-accent">
            <Icon />
            {showDropdownArrow && <ArrowDropDownIcon className="-ml-1 -mr-2" />}
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <TooltipLabel label={tooltipLabel} />
          </TooltipContent>
        </Tooltip>
      </DropdownMenuTrigger>
      <DropdownMenuContent>{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function FormatButtonDropdownActions({ actions }: { actions: any[] }) {
  return actions.map(({ Icon, label, labelVerbose, run }) => (
    <DropdownMenuItem onClick={run}>
      <Icon className="mr-2" />
      {labelVerbose ? labelVerbose : label}
    </DropdownMenuItem>
  ));
}

function FormatButton({ action }: { action: any }) {
  const { label, labelVerbose, Icon, keyboardShortcut } = action;

  // TODO: (jimniels) make a style, like primary color, when the format is applied
  return (
    <Tooltip>
      <TooltipTrigger className="flex h-full items-center px-2 hover:bg-accent data-[state=open]:bg-accent">
        <Icon />
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <TooltipLabel label={labelVerbose ? labelVerbose : label} keyboardShortcut={keyboardShortcut} />
      </TooltipContent>
    </Tooltip>
  );
}

function TooltipLabel({ label, keyboardShortcut }: { label: string; keyboardShortcut?: string }) {
  return (
    <p>
      {label}{' '}
      {keyboardShortcut && (
        <span className="opacity-50 before:content-['('] after:content-[')']">{keyboardShortcut}</span>
      )}
    </p>
  );
}
