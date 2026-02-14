import { showAiMemoryMindMapAtom } from '@/app/atoms/aiMemoryAtom';
import {
  presentationModeAtom,
  showCellTypeOutlinesAtom,
  showCodePeekAtom,
  showGridLinesAtom,
  showHeadingsAtom,
  showScrollbarsAtom,
} from '@/app/atoms/gridSettingsAtom';
import { editorInteractionStateShowCommandPaletteAtom } from '@/app/atoms/editorInteractionStateAtom';
import { zoomIn, zoomOut, zoomReset, zoomTo100, zoomToFit, zoomToSelection } from '@/app/gridGL/helpers/zoom';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import type { CommandGroup } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { ZoomInIcon, ZoomOutIcon } from '@/shared/components/Icons';
import { Checkbox } from '@/shared/shadcn/ui/checkbox';
import { useSetAtom } from 'jotai';
import { useRecoilState, useSetRecoilState } from 'recoil';

const commands: CommandGroup = {
  heading: 'View',
  commands: [
    {
      label: 'AI memory mind map',
      Component: (props) => {
        const setShowMindMap = useSetAtom(showAiMemoryMindMapAtom);
        const setShowCommandPalette = useSetRecoilState(editorInteractionStateShowCommandPaletteAtom);
        return (
          <CommandPaletteListItem
            {...props}
            action={() => {
              setShowMindMap(true);
              setShowCommandPalette(false);
            }}
          />
        );
      },
    },
    {
      label: 'Row and column headings',
      Component: (props) => {
        const [showHeadings, setShowHeadings] = useRecoilState(showHeadingsAtom);
        return (
          <CommandPaletteListItem
            {...props}
            icon={<Checkbox checked={showHeadings} />}
            action={() => setShowHeadings((prev) => !prev)}
          />
        );
      },
    },

    {
      label: 'Grid lines',
      Component: (props) => {
        const [showGridLines, setShowGridLines] = useRecoilState(showGridLinesAtom);
        return (
          <CommandPaletteListItem
            {...props}
            icon={<Checkbox checked={showGridLines} />}
            action={() => setShowGridLines((prev) => !prev)}
          />
        );
      },
    },
    {
      label: 'Code cell outlines',
      Component: (props) => {
        const [showCellTypeOutlines, setShowCellTypeOutlines] = useRecoilState(showCellTypeOutlinesAtom);
        return (
          <CommandPaletteListItem
            {...props}
            icon={<Checkbox checked={showCellTypeOutlines} />}
            action={() => setShowCellTypeOutlines((prev) => !prev)}
          />
        );
      },
    },
    {
      label: 'Code peek',
      Component: (props) => {
        const [showCodePeek, setShowCodePeek] = useRecoilState(showCodePeekAtom);
        return (
          <CommandPaletteListItem
            {...props}
            icon={<Checkbox checked={showCodePeek} />}
            action={() => setShowCodePeek((prev) => !prev)}
          />
        );
      },
    },
    {
      label: 'Scrollbars',
      Component: (props) => {
        const [showScrollbars, setShowScrollbars] = useRecoilState(showScrollbarsAtom);
        return (
          <CommandPaletteListItem
            {...props}
            icon={<Checkbox checked={showScrollbars} />}
            action={() => setShowScrollbars((prev) => !prev)}
          />
        );
      },
    },
    {
      label: 'Presentation mode',
      Component: (props) => {
        const [presentationMode, setPresentationMode] = useRecoilState(presentationModeAtom);
        return (
          <CommandPaletteListItem
            {...props}
            icon={<Checkbox checked={presentationMode} />}
            action={() => setPresentationMode((prev) => !prev)}
            shortcut="."
            shortcutModifiers={[KeyboardSymbols.Command]}
          />
        );
      },
    },
    {
      label: 'Zoom in',
      Component: (props) => (
        <CommandPaletteListItem
          {...props}
          icon={<ZoomInIcon />}
          action={() => {
            zoomIn();
          }}
          shortcut="+"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      ),
    },
    {
      label: 'Zoom out',
      Component: (props) => (
        <CommandPaletteListItem
          {...props}
          icon={<ZoomOutIcon />}
          action={() => {
            zoomOut();
          }}
          shortcut="−"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      ),
    },
    {
      label: 'Zoom to selection',
      Component: (props) => (
        <CommandPaletteListItem
          {...props}
          action={() => {
            zoomToSelection();
          }}
          shortcut="8"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      ),
    },
    {
      label: 'Zoom to fit',
      Component: (props) => (
        <CommandPaletteListItem
          {...props}
          action={() => {
            zoomToFit();
          }}
          shortcut="9"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      ),
    },
    {
      label: 'Zoom to 100%',
      Component: (props) => (
        <CommandPaletteListItem
          {...props}
          action={() => {
            zoomTo100();
          }}
          shortcut="0"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      ),
    },
    {
      label: 'Reset Viewport',
      Component: (props) => <CommandPaletteListItem {...props} action={() => zoomReset()} />,
    },
  ],
};

export default commands;
