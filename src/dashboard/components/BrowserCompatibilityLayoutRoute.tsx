import { ErrorOutline } from '@mui/icons-material';
import { isWebGLSupported } from '@pixi/utils';
import * as Sentry from '@sentry/react';
import { Outlet } from 'react-router-dom';
import { Empty } from '../../components/Empty';
import { isWASMSupported } from '../../utils/isWASMSupported';

export function BrowserCompatibilityLayoutRoute() {
  if (!isWASMSupported || !isWebGLSupported()) {
    Sentry.captureEvent({
      message: 'Browser does not support WebGL or WASM',
      level: 'info',
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
