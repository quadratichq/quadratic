import TopBar from '../ui/menus/TopBar';
import CodeEditor from '../ui/menus/CodeEditor';
import DebugMenu from './menus/DebugMenu/DebugMenu';
import useLocalStorage from '../hooks/useLocalStorage';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import BottomBar from './menus/BottomBar';
import QuadraticGrid from '../gridGL/QuadraticGrid';
import CommandPalette from './menus/CommandPalette';
import GoTo from './menus/GoTo';
import { useEffect, useState } from 'react';
import { PixiApp } from '../gridGL/pixiApp/PixiApp';
import { SheetController } from '../grid/controller/sheetController';
import CellTypeMenu from './menus/CellTypeMenu';
import { useGridSettings } from './menus/TopBar/SubMenus/useGridSettings';
import PresentationModeHint from './components/PresentationModeHint';

interface Props {
  sheetController: SheetController;
}

export default function QuadraticUI(props: Props) {
  const [showDebugMenu] = useLocalStorage('showDebugMenu', false);
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const { presentationMode } = useGridSettings();

  const [app] = useState(() => new PixiApp(props.sheetController));

  const { sheetController } = props;

  useEffect(() => {
    sheetController.setApp(app);
  }, [sheetController, app]);

  const showChrome = !presentationMode;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {editorInteractionState.showCellTypeMenu && <CellTypeMenu></CellTypeMenu>}
      {showDebugMenu && <DebugMenu sheet={sheetController.sheet} />}
      {showChrome && <TopBar app={app} sheetController={sheetController} />}
      {editorInteractionState.showCommandPalette && <CommandPalette app={app} sheetController={sheetController} />}
      {editorInteractionState.showGoToMenu && <GoTo app={app} sheetController={sheetController} />}

      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <QuadraticGrid sheetController={sheetController} app={app} />
        <CodeEditor editorInteractionState={editorInteractionState} sheet_controller={sheetController} />
      </div>

      {showChrome && <BottomBar sheet={sheetController.sheet} />}
      {!showChrome && <PresentationModeHint />}
    </div>
  );
}
