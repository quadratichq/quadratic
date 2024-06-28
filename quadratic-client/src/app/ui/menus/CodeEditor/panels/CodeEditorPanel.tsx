import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { PanelPositionBottomIcon, PanelPositionLeftIcon } from '@/app/ui/icons';
import { CodeEditorPanelData, PanelPosition } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { cn } from '@/shared/shadcn/utils';
import { IconButton } from '@mui/material';
import { memo, MouseEvent, useCallback } from 'react';
import { CodeEditorPanelBottom } from './CodeEditorPanelBottom';
import { CodeEditorPanelSide } from './CodeEditorPanelSide';

interface Props {
  codeEditorPanelData: CodeEditorPanelData;
}

export const CodeEditorPanel = memo((props: Props) => {
  const { codeEditorPanelData } = props;
  const { panelPosition, setPanelPosition } = codeEditorPanelData;

  const changePanelPosition = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      setPanelPosition((prev: PanelPosition) => (prev === 'left' ? 'bottom' : 'left'));
      e.currentTarget.blur();
    },
    [setPanelPosition]
  );

  return (
    <>
      {/* Panel position (left/bottom) control */}
      <div className={cn('absolute z-10', panelPosition === 'bottom' ? 'right-1.5 top-1.5' : 'right-0.5 top-0.5')}>
        <TooltipHint title={panelPosition === 'bottom' ? 'Move panel left' : 'Move panel bottom'}>
          <IconButton onClick={changePanelPosition}>
            {panelPosition === 'left' ? <PanelPositionBottomIcon /> : <PanelPositionLeftIcon />}
          </IconButton>
        </TooltipHint>
      </div>

      {panelPosition === 'left' && <CodeEditorPanelSide codeEditorPanelData={props.codeEditorPanelData} />}
      {panelPosition === 'bottom' && <CodeEditorPanelBottom codeEditorPanelData={props.codeEditorPanelData} />}
    </>
  );
});
