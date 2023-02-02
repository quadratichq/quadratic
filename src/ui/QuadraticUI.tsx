import TopBar from '../ui/menus/TopBar';
import CodeEditor from '../ui/menus/CodeEditor';
import DebugMenu from './menus/DebugMenu/DebugMenu';
import useLocalStorage from '../hooks/useLocalStorage';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import BottomBar from './menus/BottomBar';
import QuadraticGrid from '../core/gridGL/QuadraticGrid';
import CommandPalette from './menus/CommandPalette';
import { useEffect, useState } from 'react';
import { PixiApp } from '../core/gridGL/pixiApp/PixiApp';
import { SheetController } from '../core/transaction/sheetController';

interface Props {
  sheetController: SheetController;
}

export default function QuadraticUI(props: Props) {
  const [showDebugMenu] = useLocalStorage('showDebugMenu', false);
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);

  const [app] = useState(() => new PixiApp(props.sheetController));

  const { sheetController } = props;

  useEffect(() => {
    sheetController.setApp(app);
  }, [sheetController, app]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {showDebugMenu && <DebugMenu sheet={sheetController.sheet} />}
      <TopBar app={app} sheetController={sheetController} />
      <CommandPalette app={app} sheetController={sheetController} />

      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        <QuadraticGrid sheetController={sheetController} app={app} />
        <CodeEditor editorInteractionState={editorInteractionState} sheet_controller={sheetController} />
      </div>

      <BottomBar sheet={sheetController.sheet} />
    </div>
  );
}
