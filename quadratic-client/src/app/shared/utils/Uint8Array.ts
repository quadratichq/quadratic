export const toUint8Array = (data: any): Uint8Array => {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(JSON.stringify(data));
  return encoded;
};

export const fromUint8Array = (data: Uint8Array): any => {
  const decoder = new TextDecoder();
  const decoded = decoder.decode(data);
  return JSON.parse(decoded);
};
