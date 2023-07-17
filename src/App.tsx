import * as React from 'react';
import './styles.css';
import { QuadraticApp } from './quadratic/QuadraticApp';
import { isWASMSupported } from './utils/isWASMSupported';
import { isWebGLSupported } from '@pixi/utils';
import { BrowserNotSupported } from './ui/overlays/BrowserNotSupported';
import * as Sentry from '@sentry/browser';
import { RecoilRoot } from 'recoil';

export const Component = () => {
  // TODO move this somewhere else
  // Check if browser supports WebGL and WASM
  if (!isWASMSupported || !isWebGLSupported()) {
    Sentry.captureEvent({
      message: 'Browser does not support WebGL or WASM',
      level: Sentry.Severity.Info,
    });

    return <BrowserNotSupported></BrowserNotSupported>;
  }

  return (
    <RecoilRoot>
      <QuadraticApp />
    </RecoilRoot>
  );
};
