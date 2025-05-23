import { requireAuth } from '@/auth/auth';
import { Onboarding, OnboardingResponseV1Schema } from '@/dashboard/onboarding/Onboarding';
import { apiClient } from '@/shared/api/apiClient';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import * as Sentry from '@sentry/react';
import mixpanel from 'mixpanel-browser';
import { useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router';
import { RecoilRoot } from 'recoil';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAuth();
  return null;
};

export const useOnboardingLoaderData = () => {
  return useLoaderData() as Awaited<ReturnType<typeof loader>>;
};

export const Component = () => {
  useRemoveInitialLoadingUI();
  return (
    <RecoilRoot>
      <Onboarding />
    </RecoilRoot>
  );
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  // Pull the form data from the URL
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  // Convert the search params to JSON
  //   key=value -> { key: value }
  //   key[]=value&key[]=value2 -> { key: [value, value2] }
  const formJson: Record<string, string | string[]> = {};
  for (const [key, value] of searchParams.entries()) {
    const isArrayKey = key.endsWith('[]');
    if (isArrayKey) {
      if (!formJson[key]) formJson[key] = [];
      if (value !== '') {
        (formJson[key] as string[]).push(value);
      }
    } else if (value !== '') {
      formJson[key] = value;
    }
  }

  // Parse and validate the payload against the v1 schema
  const result = OnboardingResponseV1Schema.safeParse({ __version: 1, ...formJson });

  // Save the responses to the server and mixpanel and log any errors
  const sentryPromises: Promise<unknown>[] = [];
  if (result.success) {
    try {
      const uploadToServerPromise = apiClient.user.update({ onboardingResponses: result.data });
      const uploadToMixpanelPromise = new Promise((resolve, reject) => {
        mixpanel.track('[Onboarding].submit', result.data, () => {
          resolve(true);
        });
      });
      const [serverResult, mixpanelResult] = await Promise.allSettled([uploadToServerPromise, uploadToMixpanelPromise]);

      if (serverResult.status === 'rejected') {
        Sentry.captureException({
          message: 'Failed to upload user onboarding responses to server',
          level: 'error',
          extra: {
            error: serverResult.reason,
          },
        });
        sentryPromises.push(Sentry.flush(2000));
      }

      if (mixpanelResult.status === 'rejected') {
        Sentry.captureException({
          message: 'Failed to upload user onboarding responses to Mixpanel',
          level: 'error',
          extra: {
            error: mixpanelResult.reason,
          },
        });
        sentryPromises.push(Sentry.flush(2000));
      }
    } catch (error) {
      Sentry.captureException({
        message: 'Unexpected error during onboarding submission',
        level: 'error',
        extra: {
          error,
        },
      });
      sentryPromises.push(Sentry.flush(2000));
    }
  } else {
    // This should never happen in prod. If it does, that's a bug and we'll send to Sentry
    Sentry.captureException({
      message: 'Invalid onboarding payload. This is a developer bug.',
      level: 'error',
      extra: {
        error: result.error,
      },
    });
    sentryPromises.push(Sentry.flush(2000));
  }

  if (sentryPromises.length > 0) {
    await Promise.all(sentryPromises);
  }

  // Redirect user to a new file
  window.location.href = '/files/create?private=false';
  return null;
};
