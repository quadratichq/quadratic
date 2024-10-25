import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import { useIsAvailableArgs } from '@/app/ui/hooks/useIsAvailableArgs';
import { CheckIcon } from '@/shared/components/Icons';
import { DropdownMenuItem, DropdownMenuShortcut } from '@/shared/shadcn/ui/dropdown-menu';

export const ContextMenuItemAction = (props: {
  action: Action;
  // allows overriding of the default option (which sets the menu item to bold)
  overrideDefaultOption?: boolean;
}): JSX.Element | null => {
  const { overrideDefaultOption } = props;
  const { label, Icon, run, isAvailable, checkbox, defaultOption } = defaultActionSpec[props.action];
  const isAvailableArgs = useIsAvailableArgs();
  const keyboardShortcut = keyboardShortcutEnumToDisplay(props.action);

  if (isAvailable && !isAvailable(isAvailableArgs)) {
    return null;
  }

  let icon = Icon ? <Icon /> : null;

  if (!Icon && checkbox !== undefined) {
    const checked = typeof checkbox === 'function' ? checkbox() : checkbox === true;
    if (checked) {
      icon = <CheckIcon />;
    }
  }

  return (
    <DropdownMenuItem
      onClick={() => {
        // @ts-expect-error
        run();
      }}
    >
      <ContextMenuItem
        icon={
          <>
            {icon}
            {checkbox === true && <CheckIcon />}
          </>
        }
        text={label}
        textBold={overrideDefaultOption ?? defaultOption}
        shortcut={keyboardShortcut}
      />
    </DropdownMenuItem>
  );
};

export const ContextMenuItem = ({
  icon,
  text,
  textBold,
  shortcut,
}: {
  icon: React.ReactNode;
  text: React.ReactNode;
  textBold?: boolean;
  shortcut?: React.ReactNode;
}): JSX.Element => {
  return (
    <>
      <span className="mr-3 flex h-6 w-6 items-center justify-center">{icon}</span>
      <span className={textBold ? 'font-bold' : ''}>{text}</span>
      {shortcut && <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>}
    </>
  );
};
