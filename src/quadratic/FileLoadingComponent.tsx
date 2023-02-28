import { useEffect } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { debugShowFileIO } from '../debugFlags';
import { localFiles } from '../grid/sheet/localFiles';
import { openExampleGridFile } from '../grid/actions/gridFile/OpenGridFile';
import { SheetController } from '../grid/controller/sheetController';

const EXAMPLE_FILE_FILENAME = 'default.grid';

interface Props {
  sheetController: SheetController;
}

export const FileLoadingComponent = (props: Props): JSX.Element | null => {
  const [firstTime, setFirstTime] = useLocalStorage('firstTime', true);

  useEffect(() => {
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
