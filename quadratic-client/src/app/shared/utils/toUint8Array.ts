export const toUint8Array = (data: any): Uint8Array => {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(JSON.stringify(data));
  return encoded;
};
