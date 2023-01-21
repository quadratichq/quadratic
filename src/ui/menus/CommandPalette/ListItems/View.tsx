import { useGridSettings } from '../../TopBar/SubMenus/useGridSettings';
import { CommandPaletteListItem } from '../CommandPaletteListItem';
import { CommandPaletteListItemCheckbox } from '../CommandPaletteListItemCheckbox';

export const CPLIViewShowAxis = (props: any) => {
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
};
