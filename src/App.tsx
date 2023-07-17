import './styles.css';
import { QuadraticAuth } from './quadratic/QuadraticAuth';
import { isWASMSupported } from './utils/isWASMSupported';
import { isWebGLSupported } from '@pixi/utils';
import { BrowserNotSupported } from './ui/overlays/BrowserNotSupported';
import * as Sentry from '@sentry/browser';
import { RecoilRoot } from 'recoil';

export default function App() {
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
      <QuadraticAuth />
    </RecoilRoot>
  );
}
