export function stripExtension(name: string): string {
  return name.replace(/\.[^/.]+$/, '');
}

export function getExtension(name: string): string {
  return name.split('.').pop() || '';
}

export function getFileTypeFromName(name: string): 'CSV' | 'Excel' | 'Parquet' | 'Grid' | undefined {
  const extension = getExtension(name);
  if (extension === 'csv') return 'CSV';
  if (extension === 'xlsx') return 'Excel';
  if (extension === 'xls') return 'Excel';
  if (extension === 'parquet' || extension === 'parq' || extension === 'pqt') return 'Parquet';
  if (extension === 'grid') return 'Grid';
  return undefined;
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
  if (isCsv(file)) return 'CSV';
  if (isExcel(file)) return 'Excel';
  if (isParquet(file)) return 'Parquet';
  if (isGrid(file)) return 'Grid';

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

export const arrayBufferToBase64 = (arrayBuffer: ArrayBuffer) => {
  const uint8Array = new Uint8Array(arrayBuffer);
  const binaryString = uint8Array.reduce((str, byte) => str + String.fromCharCode(byte), '');
  return btoa(binaryString);
};

export const supportedFileTypes = ['.grid', '.xlsx', '.xls', '.csv', '.parquet', '.parq', '.pqt'];
export const supportedFileTypesFromGrid = supportedFileTypes.filter((type) => type !== '.grid');
