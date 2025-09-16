export const toUint8Array = (data: any): Uint8Array => {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(JSON.stringify(data));
  return encoded;
};

export const fromUint8Array = <T>(data: Uint8Array): T => {
  const decoder = new TextDecoder();
  const decoded = decoder.decode(data);
  return JSON.parse(decoded) as T;
};
