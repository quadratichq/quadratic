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
  const didMount = useRef(false);
  const [sheetController] = useState<SheetController>(new SheetController());
  const [file, setFile] = useState<GridFile>(props.file);

  const save = useCallback(async (): Promise<void> => {
    const modified = Date.now();
    setFile((oldFile) => ({ ...oldFile, ...sheetController.sheet.export_file(), modified }));
  }, [sheetController.sheet]);
  useEffect(() => {
    sheetController.saveLocalFiles = save;
  }, [sheetController, save]);
  const [app] = useState(() => new PixiApp(sheetController, async () => {}));

  useEffect(() => {
    if (ITEMS_TO_LOAD.every((item) => itemsLoaded.includes(item))) {
      setLoading(false);
    }
  }, [app, itemsLoaded, sheetController, file]);

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

  // Loading Effect
  useEffect(() => {
    // Ensure this only runs once
    if (didMount.current) return;
    didMount.current = true;

    // let assets = false;
    // const prerenderQuadrants = async () => {
    //   // wait for local-files and pixi-assets to load before pre-rendering quadrants
    //   if (!assets) {
    //     return;
    //   }
    //   app.preRenderQuadrants().then(() => {
    //     setItemsLoaded((old) => ['quadrants', ...old]);
    //   });
    // };

    // populate web workers
    webWorkers.init(app);

    loadAssets().then(() => {
      setItemsLoaded((old) => ['pixi-assets', ...old]);
      // assets = true;
      // prerenderQuadrants();
    });
    init().then(() => {
      hello(); // let Rust say hello to console
      setItemsLoaded((old) => ['wasm-rust', ...old]);
    });
  }, [app]);

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
