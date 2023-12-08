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
    <div style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}>
      {multiplayerCellInput.map((cell) => (
        <MultiplayerCellEdit key={cell.sessionId} multiplayerCellInput={cell} container={container} />
      ))}
    </div>
  );
};
