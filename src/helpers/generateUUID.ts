export const generateUUID = () => {
  // We don't get types for randomUUID for free yet, so we'll just ignore this
  // https://github.com/denoland/deno/issues/12754
  // https://dev.to/amarok24/randomuuid-in-typescript-5h3i
  // @ts-ignore
  return window.crypto.randomUUID();
};
