import { colors } from '../../../theme/colors';
import TextField from '@mui/material/TextField';
import { Button } from '@mui/material';
import { Sheet } from '../../../core/gridDB/Sheet';

interface Props {
  sheet: Sheet;
}

export default function DebugMenu(props: Props) {
  const { sheet } = props;
  const { cell_dependency: dgraph } = sheet;

  const cells = sheet.debugGetCells();
  let file_state: string;

  const HUMAN_READABLE_DGRAPH = true;
  let dgraph_str = JSON.stringify(dgraph);
  if (!HUMAN_READABLE_DGRAPH) dgraph_str = JSON.stringify(dgraph);

  try {
    file_state = `${dgraph_str}\n${JSON.stringify(cells || '', null, '\t')}`;
  } catch {
    file_state = '';
  }

  return (
    <div
      style={{
        position: 'fixed',
        // top: 35,
        left: 0,
        bottom: 0,
        width: '65%',
        height: '400px',
        borderStyle: 'solid',
        borderWidth: '1px',
        borderColor: colors.mediumGray,
        backgroundColor: '#ffffff',
      }}
    >
      <Button
        onClick={() => {
          dgraph.clear();
        }}
      >
        Reset DGraph
      </Button>
      <Button
        onClick={() => {
          sheet.grid.clear();
          dgraph.clear();
        }}
      >
        Reset Grid
      </Button>
      <TextField
        disabled
        id="outlined-multiline-static"
        label="DEBUG"
        multiline
        rows={14}
        value={file_state}
        style={{ width: '100%' }}
      />
    </div>
  );
}
