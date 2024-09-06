import { MenubarItem, MenubarShortcut } from '@/shared/shadcn/ui/menubar';

// TODO: (jimniels) implement types based on ayush's PR
export const MenuItemAction = ({ action }: { action: any }) => {
  const { label, Icon, keyboardShortcut } = action;
  // TODO: (jimniels) implement isAvailable
  return (
    <MenubarItem>
      <Icon /> {label}
      <MenubarShortcut>{keyboardShortcut}</MenubarShortcut>
    </MenubarItem>
  );
};
