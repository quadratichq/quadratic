import * as React from "react";
import { TopBar } from "../ui/menus/TopBar";
import CellTypeMenu from "../ui/menus/CellTypeMenu/";
import CodeEditor from "../ui/menus/CodeEditor";

interface QuadraticUIProps {
  isOpenCellTypeMenu: boolean;
  setIsOpenCellTypeMenu: Function;
  isOpenCodeEditor: boolean;
  setIsOpenCodeEditor: Function;
}

export default function QuadraticUI(props: QuadraticUIProps) {
  const {
    isOpenCellTypeMenu,
    // setIsOpenCellTypeMenu,
    isOpenCodeEditor,
    // setIsOpenCodeEditor,
  } = props;

  return (
    <>
      <TopBar></TopBar>
      <CellTypeMenu isOpen={isOpenCellTypeMenu}></CellTypeMenu>
      <CodeEditor isOpen={isOpenCodeEditor}></CodeEditor>
    </>
  );
}
