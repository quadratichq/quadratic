import { useEffect } from "react";
import { Button } from "@mui/material";
import QuadraticUI from "../ui/QuadraticUI";
import QuadraticGrid from "../core/gridGL/QuadraticGrid";
import { RecoilRoot } from "recoil";
import { MemoryRouter } from "react-router-dom";
import { useLoading } from "../contexts/LoadingContext";
import { QuadraticLoading } from "../ui/QuadtraticLoading";
import { loadPython } from "../core/commands/python/loadPython";
import { runPython } from "../core/commands/python/runPython";

export default function QuadraticApp() {
  const { loading, setLoading } = useLoading();

  useEffect(() => {
    if (loading) {
      loadPython().then(() => {
        setLoading(false);
      });
    }
  }, [loading, setLoading]);

  const run = async () => {
    const py_result = await runPython(`
cells = await getCells(0, 0, 1, 3)
cells_unused = await getCells(10, 10, 20, 20)
print("Single Cell {}".format((await getCell(0,0)).value))
result = 1
for cell in cells:
    print(cell.value)
    result *= int(cell.value) + 4
result`);
    console.log(py_result);
    const py_result_2 = await runPython(`
print("Single Cell {}".format((await getCell(100,100)).value))
2
`);
    console.log(py_result_2);
  };

  return (
    <RecoilRoot>
      <MemoryRouter>
        {/* Provider of WebGL Canvas and Quadratic Grid */}
        <QuadraticGrid></QuadraticGrid>
        {/* Provider of All React UI Components */}
        <QuadraticUI></QuadraticUI>
        {/* Loading screen */}
        {loading && <QuadraticLoading></QuadraticLoading>}
        <Button onMouseDown={run} style={{ marginTop: "100px" }}>
          Run python code!
        </Button>
      </MemoryRouter>
    </RecoilRoot>
  );
}
