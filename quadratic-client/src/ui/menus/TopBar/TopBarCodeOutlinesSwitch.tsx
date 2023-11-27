import { focusGrid } from '../../../helpers/focusGrid';
import { TooltipHint } from '../../components/TooltipHint';
import CodeOutlinesSwitch from './CodeOutlinesSwitch';
import { useGridSettings } from './SubMenus/useGridSettings';

export const TopBarCodeOutlinesSwitch = () => {
  const settings = useGridSettings();

  return (
    <TooltipHint
      sx={{ alignSelf: 'center' }}
      title={`${settings.showCellTypeOutlines ? 'Hide' : 'Show'} code cell outlines`}
    >
      <CodeOutlinesSwitch
        onClick={() => {
          settings.setShowCellTypeOutlines(!settings.showCellTypeOutlines);
          focusGrid();
        }}
        checked={settings.showCellTypeOutlines}
      />
    </TooltipHint>
  );
};
