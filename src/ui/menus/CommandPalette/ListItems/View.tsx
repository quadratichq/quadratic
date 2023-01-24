import { CommandPaletteListItem } from '../CommandPaletteListItem';
import { ComposableCommandPaletteListItemProps } from '../CommandPaletteListItem';
import { CommandPaletteListItemCheckbox } from '../CommandPaletteListItemCheckbox';
import { zoomIn, zoomOut, zoomToFit, zoomTo100 } from '../../../../core/gridGL/helpers/zoom';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { useGridSettings } from '../../TopBar/SubMenus/useGridSettings';

const ListItems = [
  {
    label: 'View: Show axis',
    Component: (props: any) => {
      const settings = useGridSettings();
      const { sheetController, app, ...rest } = props;

      return (
        <CommandPaletteListItem
          icon={<CommandPaletteListItemCheckbox checked={settings.showHeadings} />}
          action={() => {
            settings.setShowHeadings(!settings.showHeadings);
          }}
          {...rest}
        />
      );
    },
  },
  {
    label: 'View: Zoom in',
    Component: (props: ComposableCommandPaletteListItemProps) => {
      const { sheetController, app, ...rest } = props;
      return (
        <CommandPaletteListItem
          {...rest}
          action={() => {
            zoomIn(app.viewport);
          }}
          shortcut="+"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      );
    },
  },
  {
    label: 'View: Zoom out',
    Component: (props: ComposableCommandPaletteListItemProps) => {
      const { sheetController, app, ...rest } = props;
      return (
        <CommandPaletteListItem
          {...rest}
          action={() => {
            zoomOut(app.viewport);
          }}
          shortcut="−"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      );
    },
  },

  {
    label: 'View: Zoom to fit',
    Component: (props: ComposableCommandPaletteListItemProps) => {
      const { sheetController, app, ...rest } = props;
      return (
        <CommandPaletteListItem
          {...rest}
          action={() => {
            zoomToFit(sheetController.sheet, app.viewport);
          }}
          shortcut="1"
          shortcutModifiers={[KeyboardSymbols.Shift]}
        />
      );
    },
  },
  {
    label: 'View: Zoom to 100%',
    Component: (props: ComposableCommandPaletteListItemProps) => {
      const { sheetController, app, ...rest } = props;
      return (
        <CommandPaletteListItem
          {...rest}
          action={() => {
            zoomTo100(app.viewport);
          }}
          shortcut="0"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      );
    },
  },
];

export default ListItems;
