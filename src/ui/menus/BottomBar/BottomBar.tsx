import { ChatBubbleOutline, Commit } from '@mui/icons-material';
import { Stack, useTheme } from '@mui/material';
import { formatDistance } from 'date-fns';
import { useEffect, useState } from 'react';
import { isMobileOnly } from 'react-device-detect';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { gridInteractionStateAtom } from '../../../atoms/gridInteractionStateAtom';
import { REACT_APP_VERSION } from '../../../constants/env';
import { debugShowCacheCount, debugShowCacheFlag, debugShowFPS, debugShowRenderer } from '../../../debugFlags';
import { Sheet } from '../../../grid/sheet/Sheet';
import { focusGrid } from '../../../helpers/focusGrid';
import { Cell } from '../../../schemas';
import { colors } from '../../../theme/colors';
import { ActiveSelectionStats } from './ActiveSelectionStats';
import BottomBarItem from './BottomBarItem';
import PythonState from './PythonState';
import SyncState from './SyncState';

interface Props {
  sheet: Sheet;
}

export const BottomBar = (props: Props) => {
  const [interactionState] = useRecoilState(gridInteractionStateAtom);
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);

  const [selectedCell, setSelectedCell] = useState<Cell | undefined>();
  const theme = useTheme();

  const {
    showMultiCursor,
    cursorPosition,
    multiCursorPosition: { originPosition, terminalPosition },
  } = interactionState;

  // Generate string describing cursor location
  const cursorPositionString = `(${cursorPosition.x}, ${cursorPosition.y})`;
  const multiCursorPositionString = `(${originPosition.x}, ${originPosition.y}), (${terminalPosition.x}, ${terminalPosition.y})`;

  useEffect(() => {
    const updateCellData = async () => {
      // Don't update if we have not moved cursor position
      if (
        selectedCell?.x === interactionState.cursorPosition.x &&
        selectedCell?.y === interactionState.cursorPosition.y
      )
        return;

      // Get cell at position
      const cell = props.sheet.getCellCopy(interactionState.cursorPosition.x, interactionState.cursorPosition.y);

      // If cell exists set selectedCell
      // Otherwise set to undefined
      if (cell) {
        setSelectedCell(cell);
      } else {
        setSelectedCell(undefined);
      }
    };
    updateCellData();
  }, [interactionState, selectedCell, props.sheet]);

  const handleShowGoToMenu = () => {
    setEditorInteractionState({
      ...editorInteractionState,
      showGoToMenu: true,
    });

    // Set focus back to Grid
    focusGrid();
  };

  const showOnDesktop = !isMobileOnly;

  return (
    <div
      onContextMenu={(event) => {
        // Disable right-click
        event.preventDefault();
      }}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderTop: `1px solid ${colors.mediumGray}`,
        color: colors.darkGray,
        bottom: 0,
        width: '100%',
        backdropFilter: 'blur(1px)',
        display: 'flex',
        justifyContent: 'space-between',
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(1),
        userSelect: 'none',
      }}
    >
      <Stack direction="row">
        {showOnDesktop && (
          <>
            <BottomBarItem onClick={handleShowGoToMenu}>Cursor: {cursorPositionString}</BottomBarItem>

            {showMultiCursor && <BottomBarItem>Selection: {multiCursorPositionString}</BottomBarItem>}
            {selectedCell?.last_modified && (
              <BottomBarItem>
                You, {formatDistance(Date.parse(selectedCell.last_modified), new Date(), { addSuffix: true })}
              </BottomBarItem>
            )}
          </>
        )}
        {(debugShowRenderer || true) && (
          <BottomBarItem>
            <div
              className="debug-show-renderer"
              style={{
                width: '0.7rem',
                height: '0.7rem',
                borderRadius: '50%',
              }}
            >
              &nbsp;
            </div>
          </BottomBarItem>
        )}
        {debugShowFPS && (
          <BottomBarItem>
            <span className="debug-show-FPS">--</span> FPS
          </BottomBarItem>
        )}
        {debugShowCacheFlag && (
          <BottomBarItem>
            <span className="debug-show-cache-on" />
          </BottomBarItem>
        )}
        {debugShowCacheCount && (
          <BottomBarItem>
            <span className="debug-show-cache-count" />
          </BottomBarItem>
        )}
      </Stack>
      <Stack direction="row">
        <ActiveSelectionStats interactionState={interactionState}></ActiveSelectionStats>
        <SyncState />

        {showOnDesktop && <PythonState />}
        <BottomBarItem
          icon={<ChatBubbleOutline fontSize="inherit" />}
          onClick={() => {
            setEditorInteractionState((prevState) => ({ ...prevState, showFeedbackMenu: true }));
          }}
        >
          Feedback
        </BottomBarItem>
        <BottomBarItem icon={<Commit fontSize="inherit" />}>
          Quadratic {REACT_APP_VERSION.slice(0, 7)} (BETA)
        </BottomBarItem>
      </Stack>
    </div>
  );
};
