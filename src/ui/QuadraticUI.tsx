import * as React from "react";
import { TopBar } from "../ui/menus/TopBar";
import CellTypeMenu from "../ui/menus/CellTypeMenu/";

interface QuadraticUIProps {}

export default function QuadraticUI(props: QuadraticUIProps) {
  return (
    <>
      <TopBar></TopBar>
      <CellTypeMenu ref={null}></CellTypeMenu>
    </>
  );
}
