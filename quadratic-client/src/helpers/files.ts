export function readFileAsArrayBuffer(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function (event) {
      if (event.target?.result instanceof ArrayBuffer) {
        const uint8Array = new Uint8Array(event.target.result);
        resolve(uint8Array);
      } else {
        reject(new Error('Failed to read file as ArrayBuffer'));
      }
    };

    reader.onerror = function () {
      reject(new Error('Error reading file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

export function stripExtension(name: string): string {
  return name.replace(/\.[^/.]+$/, '');
}

export function isCsv(file: File): boolean {
  return file.type === 'text/csv' || file.type === 'text/tab-separated-values';
}

export function isExcel(file: File): boolean {
  return (
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    new RegExp(/.xlsx$/i).test(file.name)
  );
}

export function isGrid(file: File): boolean {
  return file.type === 'application/json' || new RegExp(/.grid$/i).test(file.name);
}

// NOTE(ddimaria): this mime type was registered in March 2024, so isn't supported yet
export function isParquet(file: File): boolean {
  return file.type === 'application/vnd.apache.parquet' || new RegExp(/.parquet$/i).test(file.name);
}
