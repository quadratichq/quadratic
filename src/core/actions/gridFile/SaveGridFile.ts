import { GridFileSchema } from './GridFileSchema';
import { GetCellsDB } from '../../gridDB/Cells/GetCellsDB';
import { GetDGraphDB } from '../../gridDB/DGraph/GetDGraphDB';

function downloadFile(filename: string, data: string) {
  const blob = new Blob([data], { type: 'text/csv' });
  //@ts-expect-error
  if (window.navigator.msSaveOrOpenBlob) {
    //@ts-expect-error
    window.navigator.msSaveBlob(blob, filename);
  } else {
    const elem = window.document.createElement('a');
    elem.href = window.URL.createObjectURL(blob);
    elem.download = filename;
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
  }
}

export const SaveGridFile = async (autoDownload = false) => {
  // todo load grid file from JSON blob
  const cells = await GetCellsDB();
  const dgraph = await GetDGraphDB();

  // generate file as json
  const file_j = JSON.stringify({
    cells: cells,
    dgraph: dgraph.export_to_json(),
  } as GridFileSchema);

  //  autodownload file
  if (autoDownload) downloadFile('quadraticFile.grid', file_j);

  return file_j;
};
