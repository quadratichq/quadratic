export function downloadFileInBrowser(filename: string, data: string) {
  const blob = new Blob([data], { type: 'application/json' });
  //@ts-expect-error
  if (window.navigator.msSaveOrOpenBlob) {
    //@ts-expect-error
    window.navigator.msSaveBlob(blob, filename);
  } else {
    const elem = window.document.createElement('a');
    elem.href = window.URL.createObjectURL(blob);
    elem.download = filename + '.grid';
    document.body.appendChild(elem);
    elem.click();
    document.body.removeChild(elem);
  }
}
