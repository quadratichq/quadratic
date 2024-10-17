import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { keyboardShortcutEnumToDisplay } from '@/app/helpers/keyboardShortcutsDisplay';
import { useIsAvailableArgs } from '@/app/ui/hooks/useIsAvailableArgs';
import { CheckBoxEmptyIcon, CheckBoxIcon, IconComponent } from '@/shared/components/Icons';
import { MenuItem } from '@szhsin/react-menu';

interface Props {
  action: Action;
}

export const MenuItemAction = (props: Props): JSX.Element | null => {
  const { label, Icon, run, isAvailable, checkbox } = defaultActionSpec[props.action];
  const isAvailableArgs = useIsAvailableArgs();
  const keyboardShortcut = keyboardShortcutEnumToDisplay(props.action);

  if (isAvailable && !isAvailable(isAvailableArgs)) {
    return null;
  }

  return (
    <MenuItemShadStyle Icon={Icon} onClick={run} keyboardShortcut={keyboardShortcut} checkbox={checkbox}>
      {label}
    </MenuItemShadStyle>
  );
};

function MenuItemShadStyle({
  children,
  Icon,
  checkbox,
  onClick,
  keyboardShortcut,
}: {
  children: string;
  Icon?: IconComponent;
  onClick: any;
  checkbox?: boolean | (() => boolean);
  keyboardShortcut?: string;
}) {
  const menuItemClassName =
    'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50';

  const icon = Icon ? <Icon className="-ml-3 mr-4" /> : null;
  let checkboxElement: JSX.Element | null = null;
  if (!Icon && checkbox !== undefined) {
    let checked: boolean;
    if (typeof checkbox === 'function') {
      checked = checkbox();
    } else {
      checked = checkbox === true;
    }
    console.log(checked);
    if (checked) {
      checkboxElement = <CheckBoxIcon className="-ml-3 mr-4" />;
    } else {
      checkboxElement = <CheckBoxEmptyIcon className="-ml-3 mr-4" />;
    }
  }
  return (
    <MenuItem className={menuItemClassName} onClick={onClick}>
      <span className="mr-4 flex items-center">
        {icon}
        {checkboxElement} {children}
      </span>
      {keyboardShortcut && (
        <span className="ml-auto text-xs tracking-widest text-muted-foreground">{keyboardShortcut}</span>
      )}
    </MenuItem>
  );
}
