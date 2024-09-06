import { zoomIn, zoomOut, zoomTo100, zoomToFit, zoomToSelection } from '@/app/gridGL/helpers/zoom';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { ZoomInIcon, ZoomOutIcon } from '@/shared/components/Icons';
import { Checkbox } from '@/shared/shadcn/ui/checkbox';
import { useGridSettings } from '../../TopBar/SubMenus/useGridSettings';
import { CommandGroup, CommandPaletteListItem } from '../CommandPaletteListItem';

const commands: CommandGroup = {
  heading: 'View',
  commands: [
    {
      label: 'Row and column headings',
      Component: (props) => {
        const settings = useGridSettings();
        return (
          <CommandPaletteListItem
            {...props}
            icon={<Checkbox checked={settings.showHeadings} />}
            action={() => {
              settings.setShowHeadings(!settings.showHeadings);
            }}
          />
        );
      },
    },

    {
      label: 'Axis',
      Component: (props) => {
        const settings = useGridSettings();
        return (
          <CommandPaletteListItem
            {...props}
            icon={<Checkbox checked={settings.showGridAxes} />}
            action={() => {
              settings.setShowGridAxes(!settings.showGridAxes);
            }}
          />
        );
      },
    },

    {
      label: 'Grid lines',
      Component: (props) => {
        const settings = useGridSettings();
        return (
          <CommandPaletteListItem
            {...props}
            icon={<Checkbox checked={settings.showGridLines} />}
            action={() => {
              settings.setShowGridLines(!settings.showGridLines);
            }}
          />
        );
      },
    },
    {
      label: 'Code cell outlines',
      Component: (props) => {
        const settings = useGridSettings();
        return (
          <CommandPaletteListItem
            {...props}
            icon={<Checkbox checked={settings.showCellTypeOutlines} />}
            action={() => {
              settings.setShowCellTypeOutlines(!settings.showCellTypeOutlines);
            }}
          />
        );
      },
    },
    {
      label: 'Code peek',
      Component: (props) => {
        const settings = useGridSettings();
        return (
          <CommandPaletteListItem
            {...props}
            icon={<Checkbox checked={settings.showCodePeek} />}
            action={() => {
              settings.setShowCodePeek(!settings.showCodePeek);
            }}
          />
        );
      },
    },
    {
      label: 'Presentation mode',
      Component: (props) => {
        const { presentationMode, setPresentationMode } = useGridSettings();
        return (
          <CommandPaletteListItem
            {...props}
            icon={<Checkbox checked={presentationMode} />}
            action={() => {
              setPresentationMode(!presentationMode);
            }}
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
  ],
};

export default commands;
