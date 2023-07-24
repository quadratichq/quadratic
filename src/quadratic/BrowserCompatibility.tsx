// import { ReactNode } from 'react';
import * as Sentry from '@sentry/browser';
import { isWebGLSupported } from '@pixi/utils';
import { isWASMSupported } from '../utils/isWASMSupported';
import Empty from '../dashboard/Empty';
import { Outlet } from 'react-router-dom';
import { ErrorOutline } from '@mui/icons-material';

export default function BrowserCompatibility() {
  if (!isWASMSupported || !isWebGLSupported()) {
    Sentry.captureEvent({
      message: 'Browser does not support WebGL or WASM',
      level: Sentry.Severity.Info,
    });

    return (
      <Empty
        title="Browser not supported"
        description="Your browser does not support WebAssembly or WebGL. We recommend using the latest version of Google Chrome."
        Icon={ErrorOutline}
        severity="error"
      />
    );
  }

  return <Outlet />;
}
