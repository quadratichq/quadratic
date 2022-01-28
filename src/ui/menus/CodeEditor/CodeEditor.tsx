import React from "react";
import { useNavigate } from "react-router-dom";

import AceEditor from "react-ace";
import { Drawer } from "@mui/material";

import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/ext-language_tools";

import { PYTHON_EXAMPLE_CODE } from "./python_example";

export default function CodeEditor() {
  let navigate = useNavigate();

  // const [inputCells, setInputCells] =
  //   React.useState<string>("(0, 0) -> (0, 10)");
  // const [outputCells, setOutputCells] = React.useState<string>("(10, 10)");

  // const [inputCode, setInputCode] = React.useState<string>("");

  React.useEffect(() => {
    console.log("hello asdf");
    navigate("/cell-type-menu");
  }, []);

  return (
    <Drawer anchor="right" open={true}>
      {/* <Box sx={{ flexGrow: 1, padding: "15px" }}>
        <Grid container spacing={2} columns={16}>
          <Grid item xs={8}>
            <TextField
              id="input-with-icon-textfield"
              label="Input Cell(s)"
              value={inputCells}
              onChange={(event: any) => setInputCells(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <GridOn />
                  </InputAdornment>
                ),
              }}
              variant="outlined"
            />
          </Grid>
          <Grid item xs={8}>
            <TextField
              id="input-with-icon-textfield"
              label="Output Cell(s)"
              value={outputCells}
              onChange={(event: any) => setOutputCells(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <GridOn />
                  </InputAdornment>
                ),
              }}
              variant="outlined"
            />
          </Grid>
        </Grid>
      </Box>
      <Divider></Divider> */}
      <AceEditor
        mode="python"
        theme="github"
        defaultValue={PYTHON_EXAMPLE_CODE}
        // onChange={(value) => setInputCode(value)}
        name="UNIQUE_ID_OF_DIV"
        setOptions={{
          enableBasicAutocompletion: true,
          // enableLiveAutocompletion: true,
        }}
        style={{ height: "100%" }}
      />
    </Drawer>
  );
}
