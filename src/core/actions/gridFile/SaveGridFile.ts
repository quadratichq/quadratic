import { Sheet } from '../../gridDB/Sheet';

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

export const SaveGridFile = async (sheet: Sheet, autoDownload = false) => {
  const file_j = sheet.getJSON();

  //  auto download file
  if (autoDownload) downloadFile('quadraticFile.grid', file_j);

  return file_j;
};
