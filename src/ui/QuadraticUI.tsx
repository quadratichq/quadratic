import * as React from "react";
import { Routes, Route } from "react-router-dom";
import TopBar from "../ui/menus/TopBar";
import CellTypeMenu from "../ui/menus/CellTypeMenu/";
import CodeEditor from "../ui/menus/CodeEditor";
import DebugTerminal from "./menus/DebugTerminal/DebugTerminal";
import useLocalStorage from "../hooks/useLocalStorage";

export default function QuadraticUI() {
  const [showDebugTerminal] = useLocalStorage("showDebugTerminal", false);

  return (
    <>
      <TopBar></TopBar>
      <Routes>
        <Route path="/" element={<></>} />
        <Route
          path="/cell-type-menu/:x/:y"
          element={<CellTypeMenu></CellTypeMenu>}
        />
        <Route
          path="/code-editor/:x/:y/:mode"
          element={<CodeEditor></CodeEditor>}
        />
      </Routes>
      {showDebugTerminal && <DebugTerminal />}
    </>
  );
}
