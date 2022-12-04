import { useEffect } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { loadGridFromJSON } from '../core/actions/gridFile/OpenGridFile';
import { loadLocalFile } from '../core/gridDB/localFile';
import { Sheet } from '../core/gridDB/Sheet';
import { example_grid } from './example_grid';
import { getURLParameter } from '../helpers/getURL';

interface Props {
  sheet: Sheet;
}

export const WelcomeComponent = (props: Props) => {
  const [firstTime, setFirstTime] = useLocalStorage('firstTime', true);

  useEffect(() => {

    if (getURLParameter('example')) {
      loadGridFromJSON(example_grid, props.sheet);
      return;
    }

    // On first load, open an example file.
    if (firstTime) {
      setFirstTime(false);
      loadLocalFile().then(data => {
        if (data) {
          loadGridFromJSON(data, props.sheet);
        } else if (firstTime) {
          loadGridFromJSON(example_grid, props.sheet);
        }
      });
    }
  }, [firstTime, setFirstTime, props.sheet]);

  return null;
};
