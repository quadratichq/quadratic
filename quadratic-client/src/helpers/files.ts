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
