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
    // else {
    //   checkboxElement = <CheckBoxEmptyIcon className="-ml-3 mr-4 opacity-0" />;
    // }
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

  // return (
  //   <MenuItemShadStyle Icon={Icon} onClick={run} keyboardShortcut={keyboardShortcut} checkbox={checkbox}>
  //     <span className={overrideDefaultOption ?? defaultOption ? 'font-bold' : ''}>{label}</span>
  //   </MenuItemShadStyle>
  // );
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

// function MenuItemShadStyle({
//   children,
//   Icon,
//   checkbox,
//   onClick,
//   keyboardShortcut,
// }: {
//   children: JSX.Element;
//   Icon?: IconComponent;
//   onClick: any;
//   checkbox?: boolean | (() => boolean);
//   keyboardShortcut?: string;
// }) {
//   const menuItemClassName =
//     'relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50';

//   const icon = Icon ? <Icon className="-ml-3 mr-4" /> : null;
//   let checkboxElement: JSX.Element | null = null;
//   if (!Icon && checkbox !== undefined) {
//     let checked: boolean;
//     if (typeof checkbox === 'function') {
//       checked = checkbox();
//     } else {
//       checked = checkbox === true;
//     }
//     if (checked) {
//       checkboxElement = <CheckIcon className="-ml-3 mr-4" />;
//     } else {
//       checkboxElement = <CheckBoxEmptyIcon className="-ml-3 mr-4 opacity-0" />;
//     }
//   }
//   return (
//     <MenuItem className={menuItemClassName} onClick={onClick}>
//       <span className="mr-4 flex items-center">
//         {icon}
//         {checkboxElement} {children}
//       </span>
//       {keyboardShortcut && (
//         <span className="ml-auto text-xs tracking-widest text-muted-foreground">{keyboardShortcut}</span>
//       )}
//     </MenuItem>
//   );
// }
