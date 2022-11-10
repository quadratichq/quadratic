import * as React from 'react';

import './styles.css';

import { LoadingProvider } from './contexts/LoadingContext';

import QuadraticApp from './quadratic/QuadraticApp';
import { isWASMSupported } from './utils/isWASMSupported';
import { BrowserNotSupported } from './ui/overlays/BrowserNotSupported';
import init, { hello } from 'quadratic-core';

export default function App() {
  React.useEffect(() => {
    // TODO: add calling init() to loading. Must be called before calling other wasm functions.
    init().then(() => {
      // run wasm code
      console.log(hello('world'));
    });
  }, []);

  // TODO: also check client WebGL support
  if (!isWASMSupported) return <BrowserNotSupported></BrowserNotSupported>;

  return (
    <LoadingProvider>
      {/* Provider of QuadraticApp */}
      <QuadraticApp></QuadraticApp>
    </LoadingProvider>
  );
}
