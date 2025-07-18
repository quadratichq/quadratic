import { events } from '@/app/events/events';
import { reload } from '@/routes/file.$uuid';
import mixpanel from 'mixpanel-browser';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

/**
 * Hook to handle coreError events and reload the file data without reloading the browser.
 * This should be used at a high level in the component tree to ensure the reload happens
 * before any error UI is rendered.
 */
export const useCoreErrorRedirect = () => {
  const navigate = useNavigate();
  const { uuid } = useParams() as { uuid: string };
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    const handleCoreError = async (from: string, error: Error | unknown) => {
      console.error('[useCoreErrorRedirect] Core error occurred:', { from, error });

      const errorString = JSON.stringify(
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error
      );
      mixpanel.track('coreError', { from, error: errorString });

      setIsReloading(true);

      try {
        // try to reload the file data first
        await reload(uuid);
      } catch (reloadError) {
        console.error('[useCoreErrorRedirect] Failed to reload file data:', reloadError);
        // fallback to redirecting to the file route without reloading the browser
        navigate(`/file/${uuid}`, { replace: true });
      } finally {
        setIsReloading(false);
      }
    };

    events.on('coreError', handleCoreError);

    return () => {
      events.off('coreError', handleCoreError);
    };
  }, [navigate, uuid]);

  return { isReloading };
};
