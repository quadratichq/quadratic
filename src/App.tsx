import * as React from 'react';

import './styles.css';

import { LoadingProvider } from './contexts/LoadingContext';

import { QuadraticAuth } from './quadratic/QuadraticAuth';
import { isWASMSupported } from './utils/isWASMSupported';
import { isWebGLSupported } from '@pixi/utils';
import { BrowserNotSupported } from './ui/overlays/BrowserNotSupported';
import * as Sentry from '@sentry/browser';

export default function App() {
  // Check if browser supports WebGL and WASM
  if (!isWASMSupported || !isWebGLSupported()) {
    Sentry.captureEvent({
      message: 'Browser does not support WebGL or WASM',
    });

    return <BrowserNotSupported></BrowserNotSupported>;
  }

  return (
    <LoadingProvider>
      {/* Provider of QuadraticApp */}
      <QuadraticAuth></QuadraticAuth>
    </LoadingProvider>
  );
}
