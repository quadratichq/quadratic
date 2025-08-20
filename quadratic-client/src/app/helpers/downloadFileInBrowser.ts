export function downloadQuadraticFile(filename: string, data: Uint8Array) {
  downloadFile(filename, data, 'application/json', 'grid');
}

export function downloadExcelFile(filename: string, data: Uint8Array) {
  downloadFile(filename, data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx');
}

export function downloadCsvFile(filename: string, data: Uint8Array) {
  downloadFile(filename, data, 'text/csv', 'csv');
}

export function downloadFile(filename: string, data: Uint8Array | string, mime_type: string, extension: string) {
  const blob = new Blob([data as BlobPart], { type: mime_type });
  //@ts-expect-error
  if (window.navigator.msSaveOrOpenBlob) {
    //@ts-expect-error
    window.navigator.msSaveBlob(blob, filename);
  } else {
    const elem = window.document.createElement('a');
    const objUrl = window.URL.createObjectURL(blob);
    elem.href = objUrl;
    elem.download = `${filename}.${extension}`;
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
    URL.revokeObjectURL(objUrl);
  }
}
