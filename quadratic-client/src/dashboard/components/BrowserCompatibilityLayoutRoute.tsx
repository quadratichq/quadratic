import { DOCUMENTATION_BROWSER_COMPATIBILITY_URL } from '@/shared/constants/urls';
import { isWASMSupported } from '@/shared/utils/isWASMSupported';
import { isWebGLSupported } from '@pixi/utils';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { Outlet } from 'react-router-dom';
import { Empty } from './Empty';

export function BrowserCompatibilityLayoutRoute() {
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
        severity="error"
        error={new Error('browser-not-supported')}
      />
    );
  }

  return <Outlet />;
}
