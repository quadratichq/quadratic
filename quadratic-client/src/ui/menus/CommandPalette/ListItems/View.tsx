import { zoomIn, zoomOut, zoomTo100, zoomToFit, zoomToSelection } from '../../../../gridGL/helpers/zoom';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { useGridSettings } from '../../TopBar/SubMenus/useGridSettings';
import { CommandPaletteListItem, CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';
import { CommandPaletteListItemCheckbox } from '../CommandPaletteListItemCheckbox';

const ListItems = [
  {
    label: 'View: Show row and column headings',
    Component: (props: any) => {
      const settings = useGridSettings();
      return (
        <CommandPaletteListItem
          {...props}
          icon={<CommandPaletteListItemCheckbox checked={settings.showHeadings} />}
          action={() => {
            settings.setShowHeadings(!settings.showHeadings);
          }}
        />
      );
    },
  },
  {
    label: 'View: Show axis',
    Component: (props: any) => {
      const settings = useGridSettings();
      return (
        <CommandPaletteListItem
          {...props}
          icon={<CommandPaletteListItemCheckbox checked={settings.showGridAxes} />}
          action={() => {
            settings.setShowGridAxes(!settings.showGridAxes);
          }}
        />
      );
    },
  },
  {
    label: 'View: Show grid lines',
    Component: (props: any) => {
      const settings = useGridSettings();
      return (
        <CommandPaletteListItem
          {...props}
          icon={<CommandPaletteListItemCheckbox checked={settings.showGridLines} />}
          action={() => {
            settings.setShowGridLines(!settings.showGridLines);
          }}
        />
      );
    },
  },
  {
    label: 'View: Show code cell outlines',
    Component: (props: any) => {
      const settings = useGridSettings();
      return (
        <CommandPaletteListItem
          {...props}
          icon={<CommandPaletteListItemCheckbox checked={settings.showCellTypeOutlines} />}
          action={() => {
            settings.setShowCellTypeOutlines(!settings.showCellTypeOutlines);
          }}
        />
      );
    },
  },
  // Commented out because the editor switches this state automatically when the user
  // is editing a formula.
  // {
  //   label: 'View: Show A1 notation on headings',
  //   Component: (props: any) => {
  //     const settings = useGridSettings();
  //     return (
  //       <CommandPaletteListItem
  //         {...props}
  //         icon={<CommandPaletteListItemCheckbox checked={settings.showA1Notation} />}
  //         action={() => {
  //           settings.setShowA1Notation(!settings.showA1Notation);
  //         }}
  //       />
  //     );
  //   },
  // },
  {
    label: 'View: Presentation mode',
    Component: (props: any) => {
      const { presentationMode, setPresentationMode } = useGridSettings();
      return (
        <CommandPaletteListItem
          {...props}
          icon={<CommandPaletteListItemCheckbox checked={presentationMode} />}
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
    label: 'View: Zoom in',
    Component: (props: CommandPaletteListItemSharedProps) => (
      <CommandPaletteListItem
        {...props}
        action={() => {
          zoomIn();
        }}
        shortcut="+"
        shortcutModifiers={[KeyboardSymbols.Command]}
      />
    ),
  },
  {
    label: 'View: Zoom out',
    Component: (props: CommandPaletteListItemSharedProps) => (
      <CommandPaletteListItem
        {...props}
        action={() => {
          zoomOut();
        }}
        shortcut="−"
        shortcutModifiers={[KeyboardSymbols.Command]}
      />
    ),
  },
  {
    label: 'View: Zoom to selection',
    Component: (props: CommandPaletteListItemSharedProps) => (
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
    label: 'View: Zoom to fit',
    Component: (props: CommandPaletteListItemSharedProps) => (
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
    label: 'View: Zoom to 100%',
    Component: (props: CommandPaletteListItemSharedProps) => (
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
];

export default ListItems;
