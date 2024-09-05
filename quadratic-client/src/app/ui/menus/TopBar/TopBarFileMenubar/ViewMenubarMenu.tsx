import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { CheckSmallIcon, CropFreeIcon, ZoomInIcon } from '@/shared/components/Icons';
import {
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from '@/shared/shadcn/ui/menubar';

export const ViewMenubarMenu = () => {
  return (
    <MenubarMenu>
      <MenubarTrigger>View</MenubarTrigger>
      <MenubarContent>
        {/* <MenuItem onClick={() => settings.setShowHeadings(!settings.showHeadings)}>
            <MenuLineItem primary="Show row and column headings" icon={settings.showHeadings && Check} indent />
          </MenuItem>
          <MenuItem onClick={() => settings.setShowGridAxes(!settings.showGridAxes)}>
            <MenuLineItem primary="Show grid axis" icon={settings.showGridAxes && Check} indent />
          </MenuItem>
          <MenuItem onClick={() => settings.setShowGridLines(!settings.showGridLines)}>
            <MenuLineItem primary="Show grid lines" icon={settings.showGridLines && Check} indent />
          </MenuItem>
          <MenuItem onClick={() => settings.setShowCellTypeOutlines(!settings.showCellTypeOutlines)}>
            <MenuLineItem primary="Show code cell outlines" icon={settings.showCellTypeOutlines && Check} indent />
          </MenuItem>
          <MenuItem onClick={() => settings.setShowCodePeek(!settings.showCodePeek)}>
            <MenuLineItem primary="Show code peek" icon={settings.showCodePeek && Check} indent />
          </MenuItem>
          <MenuDivider />
          <MenuItem onClick={() => settings.setPresentationMode(!settings.presentationMode)}>
            <MenuLineItem primary="Presentation mode" icon={settings.presentationMode && Check} indent />
          </MenuItem> */}
        <MenubarItem>
          <CheckSmallIcon /> Show row and column headings
        </MenubarItem>
        <MenubarItem>
          <CheckSmallIcon /> Show grid axis
        </MenubarItem>
        <MenubarItem>
          <CheckSmallIcon />
          Show grid lines
        </MenubarItem>
        <MenubarItem>
          <CheckSmallIcon />
          Show code cell outlines
        </MenubarItem>
        <MenubarItem>
          <CheckSmallIcon />
          Show code peek
        </MenubarItem>
        <MenubarSeparator />
        <MenubarItem>
          <ZoomInIcon /> Zoom
        </MenubarItem>
        <MenubarItem>
          <CropFreeIcon />
          Presentation mode
          <MenubarShortcut>{KeyboardSymbols.Command + '.'}</MenubarShortcut>
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
};
