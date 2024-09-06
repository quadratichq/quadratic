import { EditMenubarMenu } from '@/app/ui/menus/TopBar/TopBarFileMenubar/EditMenubarMenu';
import { FileMenubarMenu } from '@/app/ui/menus/TopBar/TopBarFileMenubar/FileMenubarMenu';
import { FormatMenubarMenu } from '@/app/ui/menus/TopBar/TopBarFileMenubar/FormatMenubarMenu';
import { HelpMenubarMenu } from '@/app/ui/menus/TopBar/TopBarFileMenubar/HelpMenubarMenu';
import { InsertMenubarMenu } from '@/app/ui/menus/TopBar/TopBarFileMenubar/InsertMenubarMenu';
import { ViewMenubarMenu } from '@/app/ui/menus/TopBar/TopBarFileMenubar/ViewMenubarMenu';
import { Menubar } from '@/shared/shadcn/ui/menubar';

const TopBarFileMenubar = () => {
  return (
    <Menubar>
      <FileMenubarMenu />
      <EditMenubarMenu />
      <ViewMenubarMenu />
      <InsertMenubarMenu />
      <FormatMenubarMenu />
      <HelpMenubarMenu />
    </Menubar>
  );
};

export default TopBarFileMenubar;
