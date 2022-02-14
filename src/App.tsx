import * as React from "react";

import "./styles.css";

import { LoadingProvider } from "./contexts/LoadingContext";

import QuadraticApp from "./quadratic/QuadraticApp";

export default function App() {
  return (
    <LoadingProvider>
      {/* Provider of QuadraticApp */}
      <QuadraticApp></QuadraticApp>
    </LoadingProvider>
  );
}
