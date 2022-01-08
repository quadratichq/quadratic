import * as React from "react";

import "./styles.css";

import { QuadraticLoading } from "./ui/QuadtraticLoading";

import QuadraticUI from "./ui/QuadraticUI";
import QuadraticGrid from "./core/QuadraticGrid";

export default function App() {
  const [isLoading, setIsLoading] = React.useState<Boolean>(true);

  return (
    <div style={{ height: "100%", display: "flex", justifyContent: "center" }}>
      {/* Provider of WebGL Canvas and Quadratic Grid */}
      <QuadraticGrid
        isLoading={isLoading}
        setIsLoading={setIsLoading}
      ></QuadraticGrid>
      {/* Provider of All React UI Components */}
      {!isLoading && <QuadraticUI></QuadraticUI>}
      {/* Loading screen */}
      {isLoading && <QuadraticLoading></QuadraticLoading>}
    </div>
  );
}
