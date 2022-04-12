import * as React from 'react';
import TopBar from '../ui/menus/TopBar';
import CellTypeMenu from '../ui/menus/CellTypeMenu/';
import CodeEditor from '../ui/menus/CodeEditor';
import DebugMenu from './menus/DebugMenu/DebugMenu';
import useLocalStorage from '../hooks/useLocalStorage';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../atoms/editorInteractionStateAtom';
import BottomBar from './menus/BottomBar';

export default function QuadraticUI() {
  const [showDebugMenu] = useLocalStorage('showDebugMenu', false);
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);

  return (
    <>
      <TopBar></TopBar>
      {editorInteractionState.showCellTypeMenu && <CellTypeMenu></CellTypeMenu>}
      {editorInteractionState.showCodeEditor && <CodeEditor></CodeEditor>}
      {showDebugMenu && <DebugMenu />}
      <BottomBar></BottomBar>
    </>
  );
}
