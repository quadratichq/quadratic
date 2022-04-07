import { Box } from '@mui/system';
import colors from '../../../theme/colors';
import { useRecoilState } from 'recoil';
import { gridInteractionStateAtom } from '../../../atoms/gridInteractionStateAtom';

export const BottomBar = () => {
  const [interactionState] = useRecoilState(gridInteractionStateAtom);

  const cursorPositionString = `(${interactionState.cursorPosition.x}, ${interactionState.cursorPosition.y})`;
  const multiCursorPositionString = `(${interactionState.multiCursorPosition.originPosition.x}, ${interactionState.multiCursorPosition.originPosition.y}), (${interactionState.multiCursorPosition.terminalPosition.x}, ${interactionState.multiCursorPosition.terminalPosition.y})`;

  return (
    <Box
      sx={{
        position: 'fixed',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        color: colors.darkGray,
        bottom: 0,
        width: '100%',
        height: '1.5rem',
        backdropFilter: 'blur(1px)',
        display: 'flex',
        justifyContent: 'space-between',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        fontFamily: 'sans-serif',
        fontSize: '0.7rem',
        userSelect: 'none',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span>You, 30 seconds ago.</span>
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        {interactionState.showMultiCursor ? (
          <span
            style={{ cursor: 'pointer' }}
            onClick={() => {
              navigator.clipboard.writeText(multiCursorPositionString);
            }}
          >
            Selection: {multiCursorPositionString}
          </span>
        ) : (
          <span
            style={{ cursor: 'pointer' }}
            onClick={() => {
              navigator.clipboard.writeText(cursorPositionString);
            }}
          >
            Cursor: {cursorPositionString}
          </span>
        )}
        <span>✓ WebGL</span>
        <span>✓ Python</span>
        <span>✕ SQL</span>
        <span>✕ JS</span>
      </Box>
    </Box>
  );
};
