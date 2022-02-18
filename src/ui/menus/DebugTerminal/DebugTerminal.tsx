// import { useState } from "react";
import { GetDGraphDB } from "../../../core/gridDB/DGraph/GetDGraphDB";
import { UpdateDGraphDB } from "../../../core/gridDB/DGraph/UpdateDGraphDB";
import { GetCellsDB } from "../../../core/gridDB/Cells/GetCellsDB";
import { qdb } from "../../../core/gridDB/db";
import { useLiveQuery } from "dexie-react-hooks";
import colors from "../../../theme/colors";
import TextField from "@mui/material/TextField";
import { Button } from "@mui/material";
import QuadraticDependencyGraph from "../../../core/dgraph/QuadraticDependencyGraph";
// import CellReference from "../../../core/gridGL/types/cellReference";

export default function DebugTerminal() {
  //   const [debugContent, setDebugContent] = useState<string>("");
  const dgraph = useLiveQuery(() => GetDGraphDB());
  const cells = useLiveQuery(() => GetCellsDB());

  const dgraph_json_str = dgraph?.export_to_json();

  let file_state: string;
  try {
    file_state = `${JSON.stringify(
      JSON.parse(dgraph_json_str || ""),
      null,
      "\t"
    )}\n${JSON.stringify(cells || "", null, "\t")}`;
  } catch {
    file_state = "";
  }

  return (
    <div
      style={{
        position: "fixed",
        // top: 35,
        left: 0,
        bottom: 0,
        width: "65%",
        height: "400px",
        borderStyle: "solid",
        borderWidth: "0 0 0 1px",
        borderColor: colors.mediumGray,
        backgroundColor: "#ffffff",
      }}
    >
      <TextField
        disabled
        id="outlined-multiline-static"
        label="DEBUG"
        multiline
        rows={15}
        value={file_state}
        style={{ width: "100%" }}
      />
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
    </div>
  );
}
