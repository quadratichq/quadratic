import { MultiplayerCellEdit } from './MultiplayerCellEdit';
import { useMultiplayerCellEdit } from './useMultiplayerCellEdit';

export const MultiplayerCellEdits = () => {
  const multiplayerCellInput = useMultiplayerCellEdit();

  return (
    <div style={{ pointerEvents: 'none' }}>
      {multiplayerCellInput.map((cell) => (
        <MultiplayerCellEdit key={cell.sessionId} multiplayerCellInput={cell} />
      ))}
    </div>
  );
};
