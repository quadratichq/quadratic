import { useEffect } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { LoadGridFromJSON } from '../core/actions/gridFile/OpenGridFile';
import { loadLocalFile } from '../core/gridDB/localFile';
import { Sheet } from '../core/gridDB/Sheet';

interface Props {
  sheet: Sheet;
}

export const WelcomeComponent = (props: Props) => {
  const [firstTime, setFirstTime] = useLocalStorage('firstTime', true);

  useEffect(() => {
    // On first load, open an example file.
    if (firstTime) {
      setFirstTime(false);

      loadLocalFile().then(data => {
        if (data) {
          LoadGridFromJSON(data, props.sheet);
        }
      });
    }
  }, [firstTime, setFirstTime, props]);

  return null;
};
