import React from "react";

import QuadraticUI from "../ui/QuadraticUI";
import QuadraticGrid from "../grid/QuadraticGrid";
import { RecoilRoot } from "recoil";
import { BrowserRouter } from "react-router-dom";

interface QuadraticAppProps {
  isLoading: boolean;
  setIsLoading: Function;
}

export default function QuadraticApp(props: QuadraticAppProps) {
  // One state, json serializable
  // Actions on state OpenNewCell() -> modifies attributes of state
  // Actions can be passed across users as well to keep users in sync

  const { isLoading, setIsLoading } = props;

  return (
    <RecoilRoot>
      <BrowserRouter>
        {/* Provider of WebGL Canvas and Quadratic Grid */}
        <QuadraticGrid
          isLoading={isLoading}
          setIsLoading={setIsLoading}
        ></QuadraticGrid>
        {/* Provider of All React UI Components */}
        {!isLoading && <QuadraticUI></QuadraticUI>}
      </BrowserRouter>
    </RecoilRoot>
  );
}
