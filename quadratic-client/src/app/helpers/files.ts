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

export function getExtension(name: string): string {
  return name.split('.').pop() || '';
}

export function hasExtension(name: string, extension: string): boolean {
  return new RegExp(`\\.${extension}$`, 'i').test(name);
}

export function hasExtensions(name: string, extensions: string[]): boolean {
  return extensions.some((extension) => hasExtension(name, extension));
}

export function isCsv(file: File): boolean {
  return file.type === 'text/csv' || file.type === 'text/tab-separated-values' || hasExtension(file.name, 'csv');
}

export function isExcelMimeType(mimeType: string): boolean {
  return ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(
    mimeType
  );
}

export function isExcel(file: File): boolean {
  return isExcelMimeType(file.type) || hasExtension(file.name, 'xlsx');
}

export function isGrid(file: File): boolean {
  return file.type === 'application/json' || hasExtension(file.name, 'grid');
}

// NOTE(ddimaria): this mime type was registered in March 2024, so isn't supported yet
export function isParquet(file: File): boolean {
  return file.type === 'application/vnd.apache.parquet' || hasExtensions(file.name, ['parquet', 'parq', 'pqt']);
}

export const getFileType = (file: File) => {
  if (isCsv(file)) return 'csv';
  if (isExcel(file)) return 'excel';
  if (isParquet(file)) return 'parquet';
  if (isGrid(file)) return 'grid';

  throw new Error(`Unsupported file type`);
};

export const uploadFile = async (fileTypes: string[]): Promise<File[]> => {
  const files = await new Promise<File[]>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = fileTypes.join(',');
    input.multiple = true;
    input.onchange = () => {
      if (!input.files) return;
      resolve(Array.from(input.files));
    };
    input.click();
  });
  return files;
};

export const supportedFileTypes = ['.grid', '.xlsx', '.xls', '.csv', '.parquet', '.parq', '.pqt'];
export const supportedFileTypesFromGrid = supportedFileTypes.filter((type) => type !== '.grid');
