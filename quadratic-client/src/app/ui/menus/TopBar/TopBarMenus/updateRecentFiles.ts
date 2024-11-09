//! This updates localStorage with a list of recently opened files on the user's
//! machine. This is called when a file is opened (successfully or not). The
//! file menu uses useLocalStorage to access this data (it cannot be done here
//! or in an Atom b/c of the timing of when the file is opened).

export interface RecentFile {
  uuid: string;
  name: string;
}

const MAX_RECENT_FILES = 10;
export const RECENT_FILES_KEY = 'recent_files';

export const updateRecentFiles = (uuid: string, name: string, loaded: boolean, onlyIfExists = false) => {
  try {
    if (loaded) {
      const existing = localStorage.getItem(RECENT_FILES_KEY);
      const recentFiles = existing ? JSON.parse(existing) : [];
      if (onlyIfExists && !recentFiles.find((file: RecentFile) => file.uuid === uuid)) {
        return;
      }
      const newRecentFiles = [{ uuid, name }, ...recentFiles.filter((file: RecentFile) => file.uuid !== uuid)];
      while (newRecentFiles.length > MAX_RECENT_FILES) {
        newRecentFiles.pop();
      }
      localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(newRecentFiles));
    } else {
      const existing = localStorage.getItem(RECENT_FILES_KEY);
      const recentFiles = existing ? JSON.parse(existing) : [];
      localStorage.setItem(
        RECENT_FILES_KEY,
        JSON.stringify(recentFiles.filter((file: RecentFile) => file.uuid !== uuid))
      );
    }
  } catch (e) {
    console.warn('Unable to update recent files', e);
  }
};
