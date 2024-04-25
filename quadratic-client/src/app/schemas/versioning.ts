export const versionGTE = (file: string, target: string) => {
  let fileSplit = file.split('.');
  const fileMajor = parseInt(fileSplit[0]);
  const fileMinor = parseInt(fileSplit[1]);
  const filePatch = parseInt(fileSplit[2]);

  const targetSplit = target.split('.');
  const targetMajor = parseInt(targetSplit[0]);
  const targetMinor = parseInt(targetSplit[1]);
  const targetPatch = parseInt(targetSplit[2]);

  if (fileMajor > targetMajor) return true;
  if (fileMajor < targetMajor) return false;

  if (fileMinor > targetMinor) return true;
  if (fileMinor < targetMinor) return false;

  if (filePatch > targetPatch) return true;
  if (filePatch < targetPatch) return false;

  return true;
};
