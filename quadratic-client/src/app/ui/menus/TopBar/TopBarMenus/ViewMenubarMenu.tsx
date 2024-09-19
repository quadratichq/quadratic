import { Action } from '@/app/actions/actions';
import {
  presentationModeAtom,
  showCellTypeOutlinesAtom,
  showCodePeekAtom,
  showGridAxesAtom,
  showGridLinesAtom,
  showHeadingsAtom,
} from '@/app/atoms/gridSettingsAtom';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { MenubarItemAction } from '@/app/ui/menus/TopBar/TopBarMenus/MenubarItemAction';
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
import { useRecoilState, useSetRecoilState } from 'recoil';

const MenubarItemCheckbox = ({ checked }: { checked: boolean }) => {
  return <CheckSmallIcon className={checked ? 'visible opacity-100' : 'invisible opacity-0'} />;
};

// TODO: (enhancement) move these into `viewActionsSpec` by making the `.run()`
// function of each accessible from outside of react (e.g. without `useGridSettings`)
export const ViewMenubarMenu = () => {
  const [showHeadings, setShowHeadings] = useRecoilState(showHeadingsAtom);
  const [showGridAxes, setShowGridAxes] = useRecoilState(showGridAxesAtom);
  const [showGridLines, setShowGridLines] = useRecoilState(showGridLinesAtom);
  const [showCellTypeOutlines, setShowCellTypeOutlines] = useRecoilState(showCellTypeOutlinesAtom);
  const [showCodePeek, setShowCodePeek] = useRecoilState(showCodePeekAtom);
  const setPresentationMode = useSetRecoilState(presentationModeAtom);

  return (
    <MenubarMenu>
      <MenubarTrigger>View</MenubarTrigger>
      <MenubarContent>
        <MenubarItem onClick={() => setShowHeadings((prev) => !prev)}>
          <MenubarItemCheckbox checked={showHeadings} /> Show row and column headings
        </MenubarItem>
        <MenubarItem onClick={() => setShowGridAxes((prev) => !prev)}>
          <MenubarItemCheckbox checked={showGridAxes} /> Show grid axis
        </MenubarItem>
        <MenubarItem onClick={() => setShowGridLines((prev) => !prev)}>
          <MenubarItemCheckbox checked={showGridLines} />
          Show grid lines
        </MenubarItem>
        <MenubarItem onClick={() => setShowCellTypeOutlines((prev) => !prev)}>
          <MenubarItemCheckbox checked={showCellTypeOutlines} />
          Show code cell outlines
        </MenubarItem>
        <MenubarItem onClick={() => setShowCodePeek((prev) => !prev)}>
          <MenubarItemCheckbox checked={showCodePeek} />
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
        <MenubarItem onClick={() => setPresentationMode((prev) => !prev)}>
          <CropFreeIcon />
          Presentation mode
          <MenubarShortcut>{KeyboardSymbols.Command + '.'}</MenubarShortcut>
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
};
