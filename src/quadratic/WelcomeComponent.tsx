import { useEffect } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import { GridFileSchema } from '../core/actions/gridFile/GridFileSchema';
import { LoadGridFromJSON } from '../core/actions/gridFile/OpenGridFile';
import { qdb } from '../core/gridDB/db';
import { example_grid } from './example_grid';

export const WelcomeComponent = () => {
  const [firstTime, setFirstTime] = useLocalStorage('firstTime', true);

  useEffect(() => {
    // On first load, open an example file.
    if (firstTime) {
      setFirstTime(false);
      // Only open example file if the grid is empty.
      if (qdb.cells.cells.length === 0) LoadGridFromJSON(example_grid as GridFileSchema);
    }
  }, [firstTime, setFirstTime]);

  return null;
};
