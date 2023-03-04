export {};
/*
import { useEffect } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { getURLParameter } from '../helpers/getURL';
import { debugShowFileIO } from '../debugFlags';
import { localFiles } from '../grid/sheet/localFiles';
import { SheetController } from '../grid/controller/sheetController';

const EXAMPLE_FILE_FILENAME = 'default.grid';

interface Props {
  sheetController: SheetController;
}

export const FileLoadingComponent = (props: Props): JSX.Element | null => {
  const [firstTime, setFirstTime] = useLocalStorage('firstTime', true);

  useEffect(() => {
    const fileUrl = getURLParameter('file');
    console.log(`[WelcomeComponent] fileUrl: ${fileUrl}`);
    if (fileUrl) {
      if (debugShowFileIO) {
        console.log(`[WelcomeComponent] Loading file from url`);
      }
      openGridFileFromUrl(fileUrl, props.sheetController);
      return;
    }

    localFiles.loadLocalLastFile().then((data) => {
      if (data) {
        props.sheetController.sheet.load_file(data);
      } else if (firstTime) {
        if (debugShowFileIO) {
          console.log(`[WelcomeComponent] Loading example file b/c this is the first time`);
        }
        openExampleGridFile(EXAMPLE_FILE_FILENAME, props.sheetController);
        setFirstTime(false);
      } else {
        localFiles.newFile();
      }
    });
  }, [firstTime, setFirstTime, props.sheetController]);

  return null;
};
*/