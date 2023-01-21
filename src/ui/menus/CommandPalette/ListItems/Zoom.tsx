import { CommandPaletteListItem } from '../CommandPaletteListItem';
import { ZoomIn, ZoomOut } from '@mui/icons-material';
import { CommandPaletteListItemDynamicProps } from '../CommandPaletteListItem';
import { zoomIn, zoomOut, zoomToFit, zoomTo100 } from '../../../../core/gridGL/helpers/zoom';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';

export const CPLIZoomIn = (props: CommandPaletteListItemDynamicProps) => {
  const { sheetController, app, ...rest } = props;
  return (
    <CommandPaletteListItem
      {...rest}
      action={() => {
        // @ts-ignore
        zoomIn(app.viewport);
      }}
      shortcut="+"
      shortcutModifiers={[KeyboardSymbols.Command]}
    />
  );
};

export const CPLIZoomOut = (props: CommandPaletteListItemDynamicProps) => {
  const { sheetController, app, ...rest } = props;
  return (
    <CommandPaletteListItem
      {...rest}
      action={() => {
        // @ts-ignore
        zoomOut(app.viewport);
      }}
      shortcut="−"
      shortcutModifiers={[KeyboardSymbols.Command]}
    />
  );
};

export const CPLIZoomTo100 = (props: CommandPaletteListItemDynamicProps) => {
  const { sheetController, app, ...rest } = props;
  return (
    <CommandPaletteListItem
      {...rest}
      action={() => {
        // @ts-ignore
        zoomTo100(app.viewport);
      }}
      shortcut="0"
      shortcutModifiers={[KeyboardSymbols.Command]}
    />
  );
};

export const CPLIZoomToFit = (props: CommandPaletteListItemDynamicProps) => {
  const { sheetController, app, ...rest } = props;
  return (
    <CommandPaletteListItem
      {...rest}
      action={() => {
        // @ts-ignore
        zoomToFit(sheetController.sheet, app.viewport);
      }}
      shortcut="1"
      shortcutModifiers={[KeyboardSymbols.Shift]}
    />
  );
};
