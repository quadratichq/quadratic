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

export default function QuadraticUI() {
  const [showDebugMenu] = useLocalStorage('showDebugMenu', false);
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);

  // this is a temporary move: need a way of getting the gridSparse in format
  // this will be moved back to QuadraticGrid once we have the rust backend where I can query cells from the menu
  const [app, setApp] = useState<PixiApp | undefined>();

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
      {showDebugMenu && <DebugMenu />}
      <TopBar app={app} />

      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        <QuadraticGrid app={app} setApp={setApp} />
        <CodeEditor editorInteractionState={editorInteractionState}></CodeEditor>
      </div>

      <BottomBar />
    </div>
  );
}
