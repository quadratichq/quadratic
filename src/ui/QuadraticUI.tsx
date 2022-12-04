import TopBar from '../ui/menus/TopBar';
import CellTypeMenu from '../ui/menus/CellTypeMenu/';
import CodeEditor from '../ui/menus/CodeEditor';
import DebugMenu from './menus/DebugMenu/DebugMenu';
import useLocalStorage from '../hooks/useLocalStorage';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import BottomBar from './menus/BottomBar';
import QuadraticGrid from '../core/gridGL/QuadraticGrid';
import { useState } from 'react';
import { PixiApp } from '../core/gridGL/pixiApp/PixiApp';
import { Sheet } from '../core/gridDB/Sheet';

interface Props {
  sheet: Sheet;
}

export default function QuadraticUI(props: Props) {
  const [showDebugMenu] = useLocalStorage('showDebugMenu', false);
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);

  const [app] = useState(new PixiApp(props.sheet));

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
      {showDebugMenu && <DebugMenu sheet={props.sheet} />}
      <TopBar app={app} sheet={props.sheet} />

      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        <QuadraticGrid sheet={props.sheet} app={app} />
        <CodeEditor editorInteractionState={editorInteractionState} sheet={props.sheet} />
      </div>

      <BottomBar sheet={props.sheet} />
    </div>
  );
}
