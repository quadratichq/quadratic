import init, { hello } from 'quadratic-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSetRecoilState } from 'recoil';
import { loadedStateAtom } from '../atoms/loadedStateAtom';
import { SheetController } from '../grid/controller/sheetController';
import { loadAssets } from '../gridGL/loadAssets';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import QuadraticUIContext from '../ui/QuadraticUIContext';
import { QuadraticLoading } from '../ui/loading/QuadraticLoading';
import { webWorkers } from '../web-workers/webWorkers';
import { GridFile } from '../schemas';

type loadableItem = 'pixi-assets' | 'wasm-rust';
const ITEMS_TO_LOAD: loadableItem[] = ['pixi-assets', 'wasm-rust'];

export const QuadraticApp = (props: { file: GridFile }) => {
  const [loading, setLoading] = useState(true);
  const [itemsLoaded, setItemsLoaded] = useState<loadableItem[]>([]);
  const setLoadedState = useSetRecoilState(loadedStateAtom);
  const didMount = useRef<boolean>(false);
  const [sheetController] = useState<SheetController>(new SheetController());
  const [file, setFile] = useState<GridFile>(props.file);

  // TODO
  const save = useCallback(async (): Promise<void> => {
    const modified = Date.now();
    setFile((oldFile) => ({ ...oldFile, ...sheetController.sheet.export_file(), modified }));
    console.log('[QuadraticApp] running save');
  }, [sheetController.sheet]);
  useEffect(() => {
    sheetController.saveFile = save;
  }, [sheetController, save]);
  const [app] = useState(() => new PixiApp(sheetController));

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

  // Initialize loading of critical assets
  useEffect(() => {
    // Ensure this only runs once
    if (didMount.current) return;
    didMount.current = true;

    // populate web workers
    webWorkers.init(app);

    loadAssets().then(() => {
      setItemsLoaded((old) => ['pixi-assets', ...old]);
    });
    init().then(() => {
      hello(); // let Rust say hello to console
      setItemsLoaded((old) => ['wasm-rust', ...old]);
    });
  }, [app]);

  // Once everything loads, run this effect
  useEffect(() => {
    if (ITEMS_TO_LOAD.every((item) => itemsLoaded.includes(item))) {
      // TODO if we're gonna do true SPA, these should run too to clear the old stuff
      // sheetController.clear();
      sheetController.sheet.load_file(file);
      // sheetController.app?.rebuild();
      // sheetController.app?.reset();
      setLoading(false);
    }
  }, [app, itemsLoaded, sheetController, file]);

  return loading ? <QuadraticLoading /> : <QuadraticUIContext {...{ sheetController, file, setFile, app }} />;
};

/*
    NEW API

    Store file in memory from initial props:
      const [localFile, setLocalFile] = useState(props.file)

    Create a context for getting values throughout app
      const {
        setLocalFile,
        localFile: { uuid, name, isPublic, readOnly }
      } = useFile();

    apiClient for changing files
      apiClient.createFile()
      apiClient.deleteFile()
      apiClient.importFile()
        importFileFromDisk().then(apiClient.importFile)
        importFileFromNetwork().then(apiClient.importFile)
    
    <FileContext>
      useEffect(change tab title, sync)


    


    



    
      
  */
