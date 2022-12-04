// import { useState } from "react";
import { GetDGraphDB } from '../../../core/gridDB/DGraph/GetDGraphDB';
import { UpdateDGraphDB } from '../../../core/gridDB/DGraph/UpdateDGraphDB';
import { GetCellsDB } from '../../../core/gridDB/Cells/GetCellsDB';
import { qdb } from '../../../core/gridDB/gridTypes';
import { useLiveQuery } from 'dexie-react-hooks';
import { colors } from '../../../theme/colors';
import TextField from '@mui/material/TextField';
import { Button } from '@mui/material';
import QuadraticDependencyGraph from '../../../core/dgraph/QuadraticDependencyGraph';
// import CellReference from "../../../core/gridGL/types/cellReference";

export default function DebugMenu() {
  //   const [debugContent, setDebugContent] = useState<string>("");
  const dgraph = useLiveQuery(() => GetDGraphDB());
  const cells = useLiveQuery(() => GetCellsDB());

  // const dgraph_json_str = dgraph?.export_to_json();

  let file_state: string;

  const HUMAN_READABLE_DGRAPH = true;
  let dgraph_str = dgraph?.human_readable_string();
  if (!HUMAN_READABLE_DGRAPH) dgraph_str = JSON.stringify(dgraph?.export_to_obj());

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
          const qdg = new QuadraticDependencyGraph();
          UpdateDGraphDB(qdg);
        }}
      >
        Reset DGraph
      </Button>
      <Button
        onClick={() => {
          qdb.cells.clear();
          qdb.qgrid.clear();
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
