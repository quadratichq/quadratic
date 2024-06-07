import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { PanelPositionBottomIcon, PanelPositionLeftIcon } from '@/app/ui/icons';
import { CodeEditorPanelBottom } from '@/app/ui/menus/CodeEditor/CodeEditorPanelBottom';
import { CodeEditorPanelSide } from '@/app/ui/menus/CodeEditor/CodeEditorPanelSide';
import { CodeEditorPanelData, PanelPosition } from '@/app/ui/menus/CodeEditor/useCodeEditorPanelData';
import { cn } from '@/shared/shadcn/utils';
import { IconButton } from '@mui/material';

interface Props {
  containerRef: React.RefObject<HTMLDivElement>;

  codeEditorPanelData: CodeEditorPanelData;
}

export function CodeEditorPanel(props: Props) {
  const {
    containerRef,

    codeEditorPanelData: { panelPosition, setPanelPosition },
  } = props;

  return (
    <>
      {/* Panel position (left/bottom) control */}
      <div className={cn('absolute', panelPosition === 'bottom' ? 'right-1.5 top-1.5' : 'right-0.5 top-0.5')}>
        <TooltipHint title={panelPosition === 'bottom' ? 'Move panel left' : 'Move panel bottom'}>
          <IconButton
            onClick={(e) => {
              setPanelPosition((prev: PanelPosition) => (prev === 'left' ? 'bottom' : 'left'));

              // TODO: figure out why keeping focus is kinda ugly
              e.currentTarget.blur();
            }}
          >
            {panelPosition === 'left' ? <PanelPositionBottomIcon /> : <PanelPositionLeftIcon />}
          </IconButton>
        </TooltipHint>
      </div>

      {panelPosition === 'left' && <CodeEditorPanelSide containerRef={containerRef} />}

      {panelPosition === 'bottom' && <CodeEditorPanelBottom />}
    </>
  );
}
