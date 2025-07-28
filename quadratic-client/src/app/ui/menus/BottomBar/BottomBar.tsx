import { inlineEditorAtom } from '@/app/atoms/inlineEditorAtom';
import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import BottomBarItem from '@/app/ui/menus/BottomBar/BottomBarItem';
import { Coordinates } from '@/app/ui/menus/BottomBar/Coordinates';
import { SelectionSummary } from '@/app/ui/menus/BottomBar/SelectionSummary';
import SyncState from '@/app/ui/menus/BottomBar/SyncState';
import { TopLeftPosition } from '@/app/ui/menus/BottomBar/TopLeftPosition';
import { memo } from 'react';
import { useRecoilValue } from 'recoil';

export const BottomBar = memo(() => {
  const { debugFlags } = useDebugFlags();

  const inlineEditorState = useRecoilValue(inlineEditorAtom);

  return (
    <div
      onContextMenu={(event) => {
        // Disable right-click
        event.preventDefault();
      }}
      className="flex h-6 w-full flex-shrink-0 select-none justify-between border-t border-border bg-background text-xs text-muted-foreground"
    >
      <div className="flex items-center">
        {/* {showOnDesktop && selectedCell?.last_modified && (
          <BottomBarItem>
            You, {formatDistance(Date.parse(selectedCell.last_modified), new Date(), { addSuffix: true })}
          </BottomBarItem>
        )} */}

        {inlineEditorState.visible && (
          <BottomBarItem className="hidden lg:block">
            {inlineEditorState.editMode ? 'Edit' : 'Enter'} (F2)
          </BottomBarItem>
        )}

        {debugFlags.getFlag('debugShowFPS') && (
          <BottomBarItem>
            <div
              className="debug-show-renderer"
              style={{
                width: '0.5rem',
                height: '0.5rem',
                borderRadius: '50%',
                marginRight: 3,
              }}
            >
              &nbsp;
            </div>
            <span className="debug-show-FPS">--</span> FPS
          </BottomBarItem>
        )}
        {debugFlags.getFlag('debugShowCoordinates') && (
          <BottomBarItem>
            <Coordinates />
          </BottomBarItem>
        )}
        {debugFlags.getFlag('debugShowTopLeftPosition') && (
          <BottomBarItem>
            <TopLeftPosition />
          </BottomBarItem>
        )}
      </div>
      <div className="mr-2 flex items-center">
        <SelectionSummary />
        <SyncState />
        <div className="hidden lg:block">
          <BottomBarItem>{import.meta.env.VITE_VERSION}</BottomBarItem>
        </div>
      </div>
    </div>
  );
});
