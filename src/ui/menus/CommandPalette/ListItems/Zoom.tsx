import { CommandPaletteListItem } from '../CommandPaletteListItem';
import { ComposableCommandPaletteListItemProps } from '../CommandPaletteListItem';
import { zoomIn, zoomOut, zoomToFit, zoomTo100 } from '../../../../core/gridGL/helpers/zoom';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';

export const CPLIZoomIn = (props: ComposableCommandPaletteListItemProps) => {
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
};

export const CPLIZoomOut = (props: ComposableCommandPaletteListItemProps) => {
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
};

export const CPLIZoomTo100 = (props: ComposableCommandPaletteListItemProps) => {
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
};

export const CPLIZoomToFit = (props: ComposableCommandPaletteListItemProps) => {
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
};
