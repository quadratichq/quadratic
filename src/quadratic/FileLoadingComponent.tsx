import { useEffect } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { Sheet } from '../core/gridDB/Sheet';
import { example_grid } from './example_grid';
import { getURLParameter } from '../helpers/getURL';
import { debugShowFileIO } from '../debugFlags';
import { localFiles } from '../core/gridDB/localFiles';

const EXAMPLE_FILE_FILENAME = 'example.grid';

interface Props {
  sheet: Sheet;
}

export const FileLoadingComponent = (props: Props): JSX.Element | null => {
  const [firstTime, setFirstTime] = useLocalStorage('firstTime', true);

  useEffect(() => {
    if (getURLParameter('example')) {
      if (debugShowFileIO) {
        console.log(`[WelcomeComponent] Loading example file b/c ?example=1`);
      }
      props.sheet.populate(example_grid);
      localFiles.saveLocal(EXAMPLE_FILE_FILENAME, props.sheet.save());
      return;
    }

    localFiles.loadLocalLastFile().then((data) => {
      if (data) {
        props.sheet.populate(data);
      } else if (firstTime) {
        if (debugShowFileIO) {
          console.log(`[WelcomeComponent] Loading example file b/c this is the first time`);
        }
        props.sheet.populate(example_grid);
        localFiles.loadedExternalFile(EXAMPLE_FILE_FILENAME, props.sheet.save());
      }
    });
  }, [firstTime, setFirstTime, props.sheet]);

  return null;
};
