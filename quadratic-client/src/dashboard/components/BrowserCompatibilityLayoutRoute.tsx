import {
  DOCUMENTATION_BROWSER_COMPATIBILITY_URL
} from '@/shared/constants/urls';
import { isWASMSupported } from '@/shared/utils/isWASMSupported';
import { isWebGLSupported } from '@pixi/utils';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import * as Sentry from '@sentry/react';
import { Outlet } from 'react-router-dom';
import { Empty } from './Empty';

export function BrowserCompatibilityLayoutRoute() {
  if (!isWASMSupported || !isWebGLSupported()) {
    Sentry.captureEvent({
      message: 'Browser does not support WebGL or WASM',
      level: 'info',
    });

    return (
      <Empty
        title="Browser not supported"
        description={["Your browser does not support WebAssembly or WebGL. We recommend using the latest version of Google Chrome and enabling hardware acceleration. ", <a className={`text-decoration: underline`} href={DOCUMENTATION_BROWSER_COMPATIBILITY_URL}>Learn more.</a>]}
        Icon={ExclamationTriangleIcon}
        severity="error"
      />
    );
  }

  return <Outlet />;
}
