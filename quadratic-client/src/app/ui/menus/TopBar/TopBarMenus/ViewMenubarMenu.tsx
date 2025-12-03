import { Action } from '@/app/actions/actions';
import {
  minimalUIModeAtom,
  presentationModeAtom,
  showAIAnalystOnStartupAtom,
  showCellTypeOutlinesAtom,
  showCodePeekAtom,
  showGridLinesAtom,
  showHeadingsAtom,
  showScrollbarsAtom,
} from '@/app/atoms/gridSettingsAtom';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { MenubarItemAction } from '@/app/ui/menus/TopBar/TopBarMenus/MenubarItemAction';
import { CheckSmallIcon, CollapseIcon, CropFreeIcon, ZoomInIcon } from '@/shared/components/Icons';
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
  const [showGridLines, setShowGridLines] = useRecoilState(showGridLinesAtom);
  const [showCellTypeOutlines, setShowCellTypeOutlines] = useRecoilState(showCellTypeOutlinesAtom);
  const [showCodePeek, setShowCodePeek] = useRecoilState(showCodePeekAtom);
  const [showScrollbars, setShowScrollbars] = useRecoilState(showScrollbarsAtom);
  const [showAIAnalystOnStartup, setShowAIAnalystOnStartup] = useRecoilState(showAIAnalystOnStartupAtom);
  const setPresentationMode = useSetRecoilState(presentationModeAtom);
  const setMinimalUIMode = useSetRecoilState(minimalUIModeAtom);

  return (
    <MenubarMenu>
      <MenubarTrigger>View</MenubarTrigger>
      <MenubarContent className="pointer-move-ignore">
        <MenubarItem onClick={() => setShowHeadings((prev) => !prev)}>
          <MenubarItemCheckbox checked={showHeadings} /> Show row and column headings
        </MenubarItem>
        <MenubarItem onClick={() => setShowGridLines((prev) => !prev)}>
          <MenubarItemCheckbox checked={showGridLines} />
          Show grid lines
        </MenubarItem>
        <MenubarItem onClick={() => setShowCellTypeOutlines((prev) => !prev)}>
          <MenubarItemCheckbox checked={showCellTypeOutlines} />
          Show code cell outlines
        </MenubarItem>
        <MenubarItem onClick={() => setShowAIAnalystOnStartup((prev) => !prev)}>
          <MenubarItemCheckbox checked={showAIAnalystOnStartup} />
          Show AI on startup
        </MenubarItem>
        <MenubarItem onClick={() => setShowCodePeek((prev) => !prev)}>
          <MenubarItemCheckbox checked={showCodePeek} />
          Show code peek
        </MenubarItem>
        <MenubarItem onClick={() => setShowScrollbars((prev) => !prev)}>
          <MenubarItemCheckbox checked={showScrollbars} />
          Show scrollbars
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
        <MenubarItem onClick={() => setMinimalUIMode((prev) => !prev)}>
          <CollapseIcon />
          Minimal UI
          <MenubarShortcut>{KeyboardSymbols.Command + KeyboardSymbols.Shift + 'M'}</MenubarShortcut>
        </MenubarItem>
        <MenubarSeparator />
      </MenubarContent>
    </MenubarMenu>
  );
};
