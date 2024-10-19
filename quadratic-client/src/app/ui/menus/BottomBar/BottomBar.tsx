import { inlineEditorAtom } from '@/app/atoms/inlineEditorAtom';
import { VERSION } from '@/shared/constants/appConstants';
import { useRecoilValue } from 'recoil';
import { debugShowFPS } from '../../../debugFlags';
import BottomBarItem from './BottomBarItem';
import { SelectionSummary } from './SelectionSummary';
import SyncState from './SyncState';

export const BottomBar = () => {
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
            <a href="https://docs.quadratichq.com/TODO:" target="_blank" rel="noopener noreferrer">
              {inlineEditorState.editMode ? 'Edit' : 'Enter'} (F2)
            </a>
          </BottomBarItem>
        )}

        {debugShowFPS && (
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
      </div>
      <div className="flex items-center">
        <SelectionSummary />
        <SyncState />
        <div className="hidden lg:block">
          <BottomBarItem>{VERSION}</BottomBarItem>
        </div>
      </div>
    </div>
  );
};
