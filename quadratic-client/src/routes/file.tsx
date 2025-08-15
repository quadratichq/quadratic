import { EmptyPage } from '@/shared/components/EmptyPage';
import { CONTACT_URL, DOCUMENTATION_BROWSER_COMPATIBILITY_URL } from '@/shared/constants/urls';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { isWASMSupported } from '@/shared/utils/isWASMSupported';
import { isWebGLSupported } from '@pixi/utils';
import { ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { captureEvent } from '@sentry/react';
import { useEffect, useState } from 'react';
import { engineName, isDesktop } from 'react-device-detect';
import { Outlet } from 'react-router';

export function Component() {
  const [overrideNonBlinkMsg, setOverrideNonBlinkMsg] = useLocalStorage('overrideNonBlinkMsg', false);
  const [showNonBlinkMsg, setShowNonBlinkMsg] = useState(
    isDesktop && engineName.toLowerCase() !== 'blink' && !overrideNonBlinkMsg
  );

  useEffect(() => {
    if (!isWASMSupported || !isWebGLSupported()) {
      trackEvent('[BrowserCompatibilityLayoutRoute].browserNotSupported', {
        isWASMSupported,
        isWebGLSupported,
      });

      captureEvent({
        message: 'Browser does not support WebGL or WASM',
        level: 'info',
      });
    }
  }, []);

  if (showNonBlinkMsg) {
    return (
      <EmptyPage
        title="Your browser is not officially supported"
        description={
          <>
            Chromium browsers are{' '}
            <a
              href={DOCUMENTATION_BROWSER_COMPATIBILITY_URL}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-primary"
            >
              officially supported
            </a>
            . You’re welcome to try non-Chromium browsers, but things might not work as expected.
          </>
        }
        Icon={InfoCircledIcon}
        showLoggedInUser={false}
        actions={
          <div className="flex justify-center gap-2">
            <Button variant="outline" asChild>
              <a href={CONTACT_URL}>Contact us</a>
            </Button>
            <Button
              onClick={() => {
                trackEvent('[BrowserCompatibilityLayoutRoute].userContinuedAnyway');
                setOverrideNonBlinkMsg(true);
                setShowNonBlinkMsg(false);
              }}
            >
              Continue anyway
            </Button>
          </div>
        }
      />
    );
  }

  if (!isWASMSupported || !isWebGLSupported()) {
    return (
      <EmptyPage
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
