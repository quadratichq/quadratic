import * as React from 'react';

import './styles.css';

import { LoadingProvider } from './contexts/LoadingContext';

import QuadraticApp from './quadratic/QuadraticApp';
import { isWASMSupported } from './utils/isWASMSupported';
import { BrowserNotSupported } from './ui/overlays/BrowserNotSupported';

export default function App() {
  // TODO: also check client WebGL support
  if (!isWASMSupported) return <BrowserNotSupported></BrowserNotSupported>;

  return (
    <LoadingProvider>
      {/* Provider of QuadraticApp */}
      <QuadraticApp></QuadraticApp>
    </LoadingProvider>
  );
}
