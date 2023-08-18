import { useEffect } from 'react';
import { useSetRecoilState } from 'recoil';
import { loadedStateAtom } from '../atoms/loadedStateAtom';
import { InitialFile } from '../dashboard/FileRoute';
import QuadraticUIContext from './QuadraticUIContext';

export default function QuadraticApp({ initialFile }: { initialFile: InitialFile }) {
  const { sheetController, app } = initialFile;
  const setLoadedState = useSetRecoilState(loadedStateAtom);

  // recoil tracks whether python is loaded
  useEffect(() => {
    const loaded = () =>
      setLoadedState((loaded) => {
        return {
          ...loaded,
          pythonLoaded: true,
        };
      });
    const error = () =>
      setLoadedState((loaded) => {
        return {
          ...loaded,
          pythonLoaded: 'error',
        };
      });
    window.addEventListener('python-loaded', loaded);
    window.addEventListener('python-error', error);
    return () => {
      window.removeEventListener('python-loaded', loaded);
      window.removeEventListener('python-error', error);
    };
  }, [setLoadedState]);

  return <QuadraticUIContext sheetController={sheetController} initialFile={initialFile} app={app} />;
}
