import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import {
  ArrowDropDownIcon,
  BorderAllIcon,
  FormatAlignLeftIcon,
  FormatColorFillIcon,
  FormatColorTextIcon,
  FormatTextWrapIcon,
  Number123Icon,
  VerticalAlignTopIcon,
} from '@/shared/components/Icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import mixpanel from 'mixpanel-browser';
import { ReactNode } from 'react';

export const FormattingBar = () => {
  return (
    <TooltipProvider>
      <div className="flex text-sm">
        <FormatButton action={Action.FormatNumberCurrency} />
        <FormatButton action={Action.FormatNumberPercent} />
        <FormatButtonDropdown showDropdownArrow tooltipLabel="More number formats" Icon={Number123Icon}>
          <FormatButtonDropdownActions actions={[Action.FormatNumberAutomatic, Action.FormatNumberScientific]} />
        </FormatButtonDropdown>
        <Separator />
        <FormatButton action={Action.FormatNumberToggleCommas} />
        <FormatButton action={Action.FormatNumberDecimalDecrease} />
        <FormatButton action={Action.FormatNumberDecimalIncrease} />

        <Separator />

        <FormatButton action={Action.ToggleBold} />
        <FormatButton action={Action.ToggleItalic} />

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
        <FormatButtonDropdown showDropdownArrow tooltipLabel="Horizontal align" Icon={FormatAlignLeftIcon}>
          <FormatButtonDropdownActions
            actions={[
              Action.FormatAlignHorizontalLeft,
              Action.FormatAlignHorizontalCenter,
              Action.FormatAlignHorizontalRight,
            ]}
          />
        </FormatButtonDropdown>
        <FormatButtonDropdown showDropdownArrow tooltipLabel="Vertical align" Icon={VerticalAlignTopIcon}>
          <FormatButtonDropdownActions
            actions={[
              Action.FormatAlignVerticalTop,
              Action.FormatAlignVerticalMiddle,
              Action.FormatAlignVerticalBottom,
            ]}
          />
        </FormatButtonDropdown>
        <FormatButtonDropdown showDropdownArrow tooltipLabel="Text wrap" Icon={FormatTextWrapIcon}>
          <FormatButtonDropdownActions
            actions={[Action.FormatTextWrapWrap, Action.FormatTextWrapOverflow, Action.FormatTextWrapClip]}
          />
        </FormatButtonDropdown>

        <Separator />

        <FormatButton action={Action.ClearFormattingBorders} />
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
      <DropdownMenuTrigger className="text-muted-foreground hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground">
        <Tooltip>
          <TooltipTrigger className="flex h-full items-center px-2  hover:bg-accent ">
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

function FormatButtonDropdownActions({ actions }: { actions: (keyof typeof defaultActionSpec)[] }) {
  return actions.map((action) => {
    const actionSpec = defaultActionSpec[action];
    if (!actionSpec) {
      throw new Error(`Action ${action} not found in defaultActionSpec`);
    }
    const { label, run } = actionSpec;
    const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;
    const labelToDisplay = 'labelVerbose' in actionSpec ? actionSpec.labelVerbose ?? label : label;
    return (
      <DropdownMenuItem
        onClick={() => {
          mixpanel.track('[FormattingBar].button', { label });
          run();
        }}
      >
        {Icon && <Icon className="mr-2" />}
        {labelToDisplay}
      </DropdownMenuItem>
    );
  });
}

function FormatButton({ action }: { action: keyof typeof defaultActionSpec }) {
  const actionSpec = defaultActionSpec[action];
  if (!actionSpec) {
    throw new Error(`Action ${action} not found in defaultActionSpec`);
  }

  const { label, run } = actionSpec;
  const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;
  const labelToDisplay = 'labelVerbose' in actionSpec ? actionSpec.labelVerbose ?? label : label;
  const keyboardShortcut = keyboardShortcutEnumToDisplay(action);

  // TODO: (jimniels) make a style, like primary color, when the format is applied
  return (
    <Tooltip>
      <TooltipTrigger
        className="flex h-full items-center px-2 text-muted-foreground hover:bg-accent hover:text-foreground data-[state=open]:bg-accent"
        onClick={() => {
          mixpanel.track('[FormattingBar].button', { label });
          run();
        }}
      >
        {Icon && <Icon />}
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <TooltipLabel label={labelToDisplay} keyboardShortcut={keyboardShortcut} />
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
