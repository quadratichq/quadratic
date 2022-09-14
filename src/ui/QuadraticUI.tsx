import * as React from 'react';
import TopBar from '../ui/menus/TopBar';
import CellTypeMenu from '../ui/menus/CellTypeMenu/';
import CodeEditor from '../ui/menus/CodeEditor';
import DebugMenu from './menus/DebugMenu/DebugMenu';
import useLocalStorage from '../hooks/useLocalStorage';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import BottomBar from './menus/BottomBar';
import QuadraticGrid from '../core/gridGL/QuadraticGrid';

export default function QuadraticUI() {
  const [showDebugMenu] = useLocalStorage('showDebugMenu', false);
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {editorInteractionState.showCellTypeMenu && <CellTypeMenu></CellTypeMenu>}
      {showDebugMenu && <DebugMenu />}
      <TopBar />

      <div style={{
        width: "100%",
        height: "100%",
        display: "flex",
        overflow: "hidden",
      }}>
        <QuadraticGrid />
        <CodeEditor editorInteractionState={editorInteractionState}></CodeEditor>
      </div>

      <BottomBar />
    </div>
  );
}
