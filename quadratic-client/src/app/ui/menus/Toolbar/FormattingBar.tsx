import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { focusGrid } from '@/app/helpers/focusGrid';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import { QColorPicker } from '@/app/ui/components/qColorPicker';
import {
  ArrowDropDownIcon,
  BorderAllIcon,
  FormatAlignLeftIcon,
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
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import mixpanel from 'mixpanel-browser';
import { ReactNode } from 'react';

export const FormattingBar = () => {
  return (
    <TooltipProvider>
      <ToggleGroup.Root
        type="multiple"
        className="flex text-sm"
        onValueChange={() => {
          console.log('fired value change');
          focusGrid();
        }}
      >
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

        <FormatColorPickerButton action={Action.FormatTextColor} />

        <Separator />

        <FormatColorPickerButton action={Action.FormatFillColor} />
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
      </ToggleGroup.Root>
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
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroup.Item value={tooltipLabel} asChild aria-label={tooltipLabel}>
            <DropdownMenuTrigger className="flex h-full items-center px-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground focus:outline-none aria-expanded:bg-accent aria-expanded:text-foreground">
              <Icon />
              {showDropdownArrow && <ArrowDropDownIcon className="-ml-1 -mr-2" />}
            </DropdownMenuTrigger>
          </ToggleGroup.Item>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <TooltipLabel label={tooltipLabel} />
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          focusGrid();
        }}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FormatButtonDropdownActions({ actions }: { actions: Action[] }) {
  return actions.map((action, key) => {
    const actionSpec = defaultActionSpec[action];
    if (!actionSpec) {
      throw new Error(`Action ${action} not found in defaultActionSpec`);
    }
    const { label, run } = actionSpec;
    const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;
    return (
      <DropdownMenuItem
        key={key}
        onClick={() => {
          mixpanel.track('[FormattingBar].button', { label });
          run();
        }}
      >
        {Icon && <Icon className="mr-2" />}
        {label}
      </DropdownMenuItem>
    );
  });
}

function FormatButton({ action }: { action: Action }) {
  const actionSpec = defaultActionSpec[action];
  if (!actionSpec) {
    throw new Error(`Action ${action} not found in defaultActionSpec`);
  }

  const { label, run } = actionSpec;
  const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;
  const keyboardShortcut = keyboardShortcutEnumToDisplay(action);

  // TODO: (jimniels) make a style, like primary color, when the format is applied
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ToggleGroup.Item
          aria-label={label}
          value={label}
          className="flex h-full items-center px-2 text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground focus:outline-none"
          onClick={() => {
            mixpanel.track('[FormattingBar].button', { label });
            run();
          }}
        >
          {Icon && <Icon />}
        </ToggleGroup.Item>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <TooltipLabel label={label} keyboardShortcut={keyboardShortcut} />
      </TooltipContent>
    </Tooltip>
  );
}

type FormatColorPickerButtonProps = {
  action: Action.FormatTextColor | Action.FormatFillColor;
};

function FormatColorPickerButton({ action }: FormatColorPickerButtonProps) {
  const actionSpec = defaultActionSpec[action];
  if (!actionSpec) {
    throw new Error(`Action ${action} not found in defaultActionSpec`);
  }
  const { label, run } = actionSpec;
  const Icon = 'Icon' in actionSpec ? actionSpec.Icon : undefined;

  return (
    <FormatButtonDropdown tooltipLabel={label} Icon={Icon}>
      <DropdownMenuItem>
        <QColorPicker
          onChangeComplete={(color) => {
            run(color);
            focusGrid();
          }}
          onClear={() => {
            run(undefined);
            focusGrid();
          }}
        />
      </DropdownMenuItem>
    </FormatButtonDropdown>
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
