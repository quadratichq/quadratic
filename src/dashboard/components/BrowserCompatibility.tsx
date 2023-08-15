// import { ReactNode } from 'react';
import { ErrorOutline } from '@mui/icons-material';
import { isWebGLSupported } from '@pixi/utils';
import * as Sentry from '@sentry/browser';
import { Outlet } from 'react-router-dom';
import { Empty } from '../../components/Empty';
import { isWASMSupported } from '../../utils/isWASMSupported';

export function BrowserCompatibility() {
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
