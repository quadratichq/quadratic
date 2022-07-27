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
import { QuadraticLoading } from './QuadtraticLoading';

interface QuadraticUIProps {
  loading: boolean;
}

export default function QuadraticUI(props: QuadraticUIProps) {
  const { loading } = props;
  const [showDebugMenu] = useLocalStorage('showDebugMenu', false);
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
          // backgroundColor: 'purple',
          height: '100%',
        }}
      >
        {/* WebGL Canvas and Quadratic Grid */}
        {!loading && <TopBar></TopBar>}

        <QuadraticGrid loading={loading}></QuadraticGrid>
        {!loading && <BottomBar></BottomBar>}
        {/* Loading screen */}
        {loading && <QuadraticLoading></QuadraticLoading>}
      </div>
      <CodeEditor editorInteractionState={editorInteractionState}></CodeEditor>
      {editorInteractionState.showCellTypeMenu && <CellTypeMenu></CellTypeMenu>}
      {showDebugMenu && <DebugMenu />}
    </>
  );
}
