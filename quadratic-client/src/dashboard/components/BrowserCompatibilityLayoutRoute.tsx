import { DOCUMENTATION_BROWSER_COMPATIBILITY_URL } from '@/shared/constants/urls';
import { isWASMSupported } from '@/shared/utils/isWASMSupported';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import * as Sentry from '@sentry/react';
import mixpanel from 'mixpanel-browser';
import { isWebGLSupported } from 'pixi.js';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Empty } from '../../shared/components/Empty';

export function BrowserCompatibilityLayoutRoute() {
  useEffect(() => {
    if (!isWASMSupported || !isWebGLSupported()) {
      mixpanel.track('[BrowserCompatibilityLayoutRoute].browserNotSupported', {
        isWASMSupported,
        isWebGLSupported,
      });

      Sentry.captureEvent({
        message: 'Browser does not support WebGL or WASM',
        level: 'info',
      });
    }
  }, []);

  if (!isWASMSupported || !isWebGLSupported()) {
    return (
      <Empty
        title="Browser not supported"
        description={[
          'Your browser does not support WebAssembly or WebGL. We recommend using the latest version of Google Chrome and enabling hardware acceleration. ',
          <a className={`text-decoration: underline`} href={DOCUMENTATION_BROWSER_COMPATIBILITY_URL}>
            Learn more.
          </a>,
        ]}
        Icon={ExclamationTriangleIcon}
      />
    );
  }

  return <Outlet />;
}
