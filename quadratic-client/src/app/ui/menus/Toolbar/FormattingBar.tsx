import { Action } from '@/app/actions/actions';
import { ActionArgs } from '@/app/actions/actionsSpec';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { focusGrid } from '@/app/helpers/focusGrid';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import { QColorPicker } from '@/app/ui/components/qColorPicker';
import { useBorders } from '@/app/ui/hooks/useBorders';
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
  const borders = useBorders();
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
        <FormatButton action={Action.FormatNumberCurrency} actionArgs={undefined} />
        <FormatButton action={Action.FormatNumberPercent} actionArgs={undefined} />
        <FormatButtonDropdown showDropdownArrow tooltipLabel="More number formats" Icon={Number123Icon}>
          <FormatButtonDropdownActions
            actions={[Action.FormatNumberAutomatic, Action.FormatNumberScientific]}
            actionArgs={undefined}
          />
        </FormatButtonDropdown>
        <Separator />
        <FormatButton action={Action.FormatNumberToggleCommas} actionArgs={undefined} />
        <FormatButton action={Action.FormatNumberDecimalDecrease} actionArgs={undefined} />
        <FormatButton action={Action.FormatNumberDecimalIncrease} actionArgs={undefined} />

        <Separator />

        <FormatButton action={Action.ToggleBold} actionArgs={undefined} />
        <FormatButton action={Action.ToggleItalic} actionArgs={undefined} />

        <FormatColorPickerButton action={Action.FormatTextColor} />

        <Separator />

        <FormatColorPickerButton action={Action.FormatFillColor} />
        <FormatButtonDropdown showDropdownArrow tooltipLabel="Borders" Icon={BorderAllIcon}>
          <FormatButtonDropdownActions
            actions={[
              Action.FormatBorderAll,
              Action.FormatBorderOuter,
              Action.FormatBorderInner,
              Action.FormatBorderVertical,
              Action.FormatBorderHorizontal,
              Action.FormatBorderLeft,
              Action.FormatBorderRight,
              Action.FormatBorderTop,
              Action.FormatBorderBottom,
              Action.FormatBorderClear,
            ]}
            actionArgs={borders}
          />
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
            actionArgs={undefined}
          />
        </FormatButtonDropdown>
        <FormatButtonDropdown showDropdownArrow tooltipLabel="Vertical align" Icon={VerticalAlignTopIcon}>
          <FormatButtonDropdownActions
            actions={[
              Action.FormatAlignVerticalTop,
              Action.FormatAlignVerticalMiddle,
              Action.FormatAlignVerticalBottom,
            ]}
            actionArgs={undefined}
          />
        </FormatButtonDropdown>
        <FormatButtonDropdown showDropdownArrow tooltipLabel="Text wrap" Icon={FormatTextWrapIcon}>
          <FormatButtonDropdownActions
            actions={[Action.FormatTextWrapWrap, Action.FormatTextWrapOverflow, Action.FormatTextWrapClip]}
            actionArgs={undefined}
          />
        </FormatButtonDropdown>

        <Separator />

        <FormatButton action={Action.ClearFormattingBorders} actionArgs={undefined} />
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

function FormatButtonDropdownActions<T extends Action>({
  actions,
  actionArgs,
}: {
  actions: T[];
  actionArgs: T extends keyof ActionArgs ? ActionArgs[T] : void;
}) {
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
          run(actionArgs);
        }}
      >
        {Icon && <Icon className="mr-2" />}
        {label}
      </DropdownMenuItem>
    );
  });
}

function FormatButton<T extends Action>({
  action,
  actionArgs,
}: {
  action: T;
  actionArgs: T extends keyof ActionArgs ? ActionArgs[T] : void;
}) {
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
            run(actionArgs);
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

function FormatColorPickerButton({ action }: { action: Action.FormatTextColor | Action.FormatFillColor }) {
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
