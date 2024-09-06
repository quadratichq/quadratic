import {
  DeleteIcon,
  DownloadIcon,
  DraftIcon,
  EditIcon,
  FileCopyIcon,
  ImportIcon,
  PersonAddIcon,
} from '@/shared/components/Icons';
import { MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarTrigger } from '@/shared/shadcn/ui/menubar';

export const FileMenubarMenu = () => {
  return (
    <MenubarMenu>
      <MenubarTrigger>File</MenubarTrigger>
      <MenubarContent>
        <MenubarItem>
          <DraftIcon /> New
        </MenubarItem>
        <MenubarItem>
          <FileCopyIcon />
          Duplicate
        </MenubarItem>
        <MenubarSeparator />
        <MenubarItem>
          <PersonAddIcon />
          Share
        </MenubarItem>
        <MenubarItem>
          <DownloadIcon /> Download
        </MenubarItem>
        <MenubarSeparator />
        <MenubarItem>
          <EditIcon />
          Rename
        </MenubarItem>
        <MenubarItem>
          <ImportIcon />
          Import
        </MenubarItem>
        <MenubarSeparator />
        <MenubarItem>
          <DeleteIcon />
          Delete
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
};
