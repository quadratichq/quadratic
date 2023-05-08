export const get_file_metadata = (file_contents: any) => {
  try {
    return {
      name: file_contents.filename,
      version: file_contents.version,
      modified: file_contents.modified,
      created: file_contents.created,
    };
  } catch (e) {
    console.error(e);
    return {
      name: undefined,
      version: undefined,
      modified: undefined,
      created: undefined,
    };
  }
};
