import { Action } from '@/app/actions/actions';
import { focusGrid } from '@/app/helpers/focusGrid';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { useGridSettings } from '@/app/ui/hooks/useGridSettings';
import { MenubarItemAction } from '@/app/ui/menus/TopBar/TopBarFileMenu/MenubarItemAction';
import { CheckSmallIcon, CropFreeIcon, ZoomInIcon } from '@/shared/components/Icons';
import {
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from '@/shared/shadcn/ui/menubar';

const MenubarItemCheckbox = ({ checked }: { checked: boolean }) => {
  return <CheckSmallIcon className={checked ? 'visible opacity-100' : 'invisible opacity-0'} />;
};

// TODO: (enhancement) move these into `viewActionsSpec` by making the `.run()`
// function of each accessible from outside of react (e.g. without `useGridSettings`)
export const ViewMenubarMenu = () => {
  const settings = useGridSettings();
  return (
    <MenubarMenu>
      <MenubarTrigger>View</MenubarTrigger>
      <MenubarContent className="top-bar-menubar">
        <MenubarItem
          onClick={() => {
            settings.setShowHeadings(!settings.showHeadings);
            focusGrid();
          }}
        >
          <MenubarItemCheckbox checked={settings.showHeadings} /> Show row and column headings
        </MenubarItem>
        <MenubarItem
          onClick={() => {
            settings.setShowGridAxes(!settings.showGridAxes);
            focusGrid();
          }}
        >
          <MenubarItemCheckbox checked={settings.showGridAxes} /> Show grid axis
        </MenubarItem>
        <MenubarItem
          onClick={() => {
            settings.setShowGridLines(!settings.showGridLines);
            focusGrid();
          }}
        >
          <MenubarItemCheckbox checked={settings.showGridLines} />
          Show grid lines
        </MenubarItem>
        <MenubarItem
          onClick={() => {
            settings.setShowCellTypeOutlines(!settings.showCellTypeOutlines);
            focusGrid();
          }}
        >
          <MenubarItemCheckbox checked={settings.showCellTypeOutlines} />
          Show code cell outlines
        </MenubarItem>
        <MenubarItem
          onClick={() => {
            settings.setShowCodePeek(!settings.showCodePeek);
            focusGrid();
          }}
        >
          <MenubarItemCheckbox checked={settings.showCodePeek} />
          Show code peek
        </MenubarItem>
        <MenubarSeparator />
        <MenubarSub>
          <MenubarSubTrigger>
            <ZoomInIcon /> Zoom
          </MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarItemAction action={Action.ZoomIn} actionArgs={undefined} />
            <MenubarItemAction action={Action.ZoomOut} actionArgs={undefined} />
            <MenubarSeparator />
            <MenubarItemAction action={Action.ZoomToSelection} actionArgs={undefined} />
            <MenubarItemAction action={Action.ZoomToFit} actionArgs={undefined} />
            <MenubarSeparator />
            <MenubarItemAction action={Action.ZoomTo50} actionArgs={undefined} />
            <MenubarItemAction action={Action.ZoomTo100} actionArgs={undefined} />
            <MenubarItemAction action={Action.ZoomTo200} actionArgs={undefined} />
          </MenubarSubContent>
        </MenubarSub>
        <MenubarItem
          onClick={() => {
            settings.setPresentationMode(!settings.presentationMode);
            focusGrid();
          }}
        >
          <CropFreeIcon />
          Presentation mode
          <MenubarShortcut>{KeyboardSymbols.Command + '.'}</MenubarShortcut>
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
};
