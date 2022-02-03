import * as React from "react";
import { Routes, Route } from "react-router-dom";
import { TopBar } from "../ui/menus/TopBar";
import CellTypeMenu from "../ui/menus/CellTypeMenu/";
import CodeEditor from "../ui/menus/CodeEditor";

export default function QuadraticUI() {
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
    </>
  );
}
