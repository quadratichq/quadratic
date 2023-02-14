import { useCallback, useEffect, useState } from 'react';
import {
  localFiles,
  LocalFilesListEvent,
  LocalFilesLoadEvent,
  LOCAL_FILES_LIST_EVENT,
  LOCAL_FILES_LOAD_EVENT,
} from '../grid/sheet/localFiles';

interface LocalFiles {
  localFilename?: string;
  fileList: string[];
}

export const useLocalFiles = (): LocalFiles => {
  const [localFilename, setLocalFilename] = useState<string | undefined>(localFiles.filename);

  const loadFile = useCallback(
    (event: CustomEvent<LocalFilesLoadEvent>) => {
      if (event.detail !== localFilename) {
        setLocalFilename(event.detail);
      }
    },
    [localFilename, setLocalFilename]
  );

  useEffect(() => {
    window.addEventListener(LOCAL_FILES_LOAD_EVENT, loadFile as EventListener);
    return () => {
      window.addEventListener(LOCAL_FILES_LOAD_EVENT, loadFile as EventListener);
    };
  }, [loadFile]);

  const [fileList, setFileList] = useState<string[]>(localFiles.fileList);

  const loadFileList = useCallback(
    (event: CustomEvent<LocalFilesListEvent>) => {
      if (event.detail !== fileList) {
        setFileList(event.detail);
      }
    },
    [fileList, setFileList]
  );

  useEffect(() => {
    window.addEventListener(LOCAL_FILES_LIST_EVENT, loadFileList as EventListener);
    return () => {
      window.removeEventListener(LOCAL_FILES_LIST_EVENT, loadFileList as EventListener);
    };
  }, [loadFileList]);

  return {
    localFilename,
    fileList,
  };
};
