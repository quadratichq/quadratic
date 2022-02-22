import { GridFileSchema } from "./GridFileSchema";
import { qdb } from "../../gridDB/db";
import { UpdateCellsDB } from "../../gridDB/Cells/UpdateCellsDB";
import { UpdateDGraphDB } from "../../gridDB/DGraph/UpdateDGraphDB";
import QuadraticDependencyGraph from "../../dgraph/QuadraticDependencyGraph";

const readFileAsync = async (file: File) => {
  // takes a File object and returns it as a string
  return new Promise<string>((resolve, reject) => {
    let reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result?.toString() || "");
    };

    reader.onerror = reject;

    reader.readAsText(file, "UTF-8");
  });
};

const openFileMenuAsync = async () => {
  // opens a input file menu for a single .grid file
  // once a file is selected, the File object is returned
  return new Promise<File>((resolve, reject) => {
    const elem = window.document.createElement("input");
    elem.type = "file";
    elem.accept = ".grid";
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);

    elem.onchange = () => {
      if (elem && elem.files?.length) {
        const fileToLoad = elem.files[0];
        resolve(fileToLoad);
      } else {
        reject();
      }
    };
  });
};

export const OpenGridFile = async () => {
  // take file input selection from user
  const fileToLoad = await openFileMenuAsync();
  const result = await readFileAsync(fileToLoad);

  // parse file
  const gridFile = JSON.parse(result) as GridFileSchema;

  // clear current grid
  await qdb.cells.clear();
  await qdb.qgrid.clear();

  // Open file cells and dgraph
  await UpdateCellsDB(gridFile.cells);
  let qdg = new QuadraticDependencyGraph();
  qdg.load_from_json(gridFile.dgraph);
  await UpdateDGraphDB(qdg);
};
