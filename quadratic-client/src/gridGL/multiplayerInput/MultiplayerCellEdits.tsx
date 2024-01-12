import { MultiplayerCellEdit } from './MultiplayerCellEdit';
import { useMultiplayerCellEdit } from './useMultiplayerCellEdit';

interface Props {
  container?: HTMLDivElement;
}

export const MultiplayerCellEdits = (props: Props) => {
  const { container } = props;
  const multiplayerCellInput = useMultiplayerCellEdit();

  if (!container) return;

  return (
    <div style={{ pointerEvents: 'none' }}>
      {multiplayerCellInput.map((cell) => (
        <MultiplayerCellEdit key={cell.sessionId} multiplayerCellInput={cell} />
      ))}
    </div>
  );
};
