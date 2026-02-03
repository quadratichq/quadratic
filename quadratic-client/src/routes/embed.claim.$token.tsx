import { requireAuth } from '@/auth/auth';
import { apiClient } from '@/shared/api/apiClient';
import { EmptyPage } from '@/shared/components/EmptyPage';
import { SpinnerIcon } from '@/shared/components/Icons';
import { CONTACT_URL } from '@/shared/constants/urls';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { memo, useEffect, useRef, useState } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { Link, useLoaderData, useParams } from 'react-router';

type LoaderData = {
  token: string;
};

export const loader = async ({ params, request }: LoaderFunctionArgs): Promise<LoaderData> => {
  // Require authentication - this will redirect to login if not authenticated
  await requireAuth(request);

  const { token } = params;
  if (!token) {
    throw new Response('Missing claim token', { status: 400 });
  }

  return { token };
};

export const Component = memo(() => {
  const { token } = useLoaderData() as LoaderData;
  const params = useParams();
  const claimToken = params.token || token;

  const [error, setError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(true);
  const claimStartedRef = useRef(false);

  // Remove the initial HTML loading UI only after claim is complete
  useRemoveInitialLoadingUI(isClaiming);

  // Claim the file
  useEffect(() => {
    if (!claimToken || claimStartedRef.current) return;

    claimStartedRef.current = true;

    const claimFile = async () => {
      try {
        const response = await apiClient.embed.claim({ claimToken });
        trackEvent('[Embed].fileClaimed', { fileUuid: response.file.uuid });

        // Redirect to the newly created file
        window.location.href = response.redirectUrl;
      } catch (err: any) {
        console.error('Failed to claim file:', err);

        if (err.status === 410) {
          setError('This import link has expired. Please try again from the embedded spreadsheet.');
        } else if (err.status === 404) {
          setError('This import link is invalid or has already been used.');
        } else {
          setError('Failed to import file. Please try again.');
        }
        setIsClaiming(false);
      }
    };

    claimFile();
  }, [claimToken]);

  if (error) {
    return (
      <EmptyPage
        title="Import failed"
        description={error}
        Icon={ExclamationTriangleIcon}
        actions={
          <div className="flex justify-center gap-2">
            <Button asChild variant="outline">
              <a href={CONTACT_URL} target="_blank" rel="noreferrer">
                Get help
              </a>
            </Button>
            <Button asChild variant="default">
              <Link to="/">Go to Dashboard</Link>
            </Button>
          </div>
        }
      />
    );
  }

  // Show loading UI while claiming
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      {/* Claim status positioned below the centered loading logo */}
      <div className="mt-56 flex w-80 flex-col items-center text-center">
        <div className="mb-4 flex items-center gap-2 text-lg font-medium">
          <SpinnerIcon className="text-muted-foreground" />
          <span>Importing your file…</span>
        </div>
        <div className="text-sm text-muted-foreground">You'll be redirected to your new spreadsheet automatically.</div>
      </div>
    </div>
  );
});

Component.displayName = 'EmbedClaimRoute';
