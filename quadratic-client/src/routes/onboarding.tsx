import { requireAuth } from '@/auth/auth';
import { getPrompt } from '@/dashboard/onboarding/getPrompt';
import { OnboardingResponseV1Schema, Questions, questionStackIdsByUse } from '@/dashboard/onboarding/Questions';
import { apiClient } from '@/shared/api/apiClient';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import * as Sentry from '@sentry/react';
import { useEffect } from 'react';
import { redirectDocument, useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router';
import { RecoilRoot } from 'recoil';

/**
 * Each question is a form. We track progress in the URL search params.
 * Each key corresponds to a question (one question per form).
 * In cases where multiple answers are possible, that's because the
 * user is able to specify 'other' and we track that via the `-other` suffix.
 * So, for example, a question might be `role` and if the user selects 'other'
 * then we'll track that as `role-other`, so the URL is:
 *
 *   ?use=work&role=other&role-other=some+user+input
 *
 * That is derived as a count of 2 questions: [use, role]
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAuth();

  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  const currentUse = searchParams.get('use');
  const uniqueKeys = new Set(Array.from(searchParams.keys()).filter((key) => !key.endsWith('-other')));
  const currentQuestionStackIds = currentUse ? questionStackIdsByUse[currentUse] : [];
  const currentIndex = uniqueKeys.size;
  const currentId = currentUse
    ? currentQuestionStackIds[currentIndex]
      ? currentQuestionStackIds[currentIndex]
      : currentQuestionStackIds[currentIndex - 1]
    : 'use';
  const currentQuestionNumber = currentQuestionStackIds.indexOf(currentId);
  const currentQuestionsTotal = currentQuestionStackIds.length - 1;

  const out = {
    currentId,
    currentIndex: currentIndex,
    currentQuestionStackIds,
    currentQuestionNumber,
    currentQuestionsTotal,
    isLastQuestion: currentQuestionStackIds.indexOf(currentId) === currentQuestionStackIds.length - 1,
  };
  return out;
};

export const useOnboardingLoaderData = () => {
  return useLoaderData() as Awaited<ReturnType<typeof loader>>;
};

export const Component = () => {
  useRemoveInitialLoadingUI();

  useEffect(() => {
    trackEvent('[Onboarding].loaded');
  }, []);

  return (
    <RecoilRoot>
      <Questions />
    </RecoilRoot>
  );
};

/**
 * All question answers are stored in the URL search params.
 * When submitted, we parse them into JSON and save them to the server.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
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
  const result = OnboardingResponseV1Schema.safeParse({
    __version: 1,
    __createdAt: new Date().toISOString(),
    ...formJson,
  });

  // Save the responses to the server and mixpanel and log any errors
  const sentryPromises: Promise<unknown>[] = [];
  let prompt = '';
  if (result.success) {
    prompt = getPrompt(result.data);
    try {
      const uploadToServerPromise = apiClient.user.update({ onboardingResponses: result.data });
      const uploadToMixpanelPromise = new Promise((resolve, reject) => {
        trackEvent('[Onboarding].submit', result.data, () => {
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
      console.error(error);
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
    console.error(result.error);
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
    await Promise.all(sentryPromises).catch(console.error);
  }

  // Hard-redirect user to a new file
  return redirectDocument(`/files/create?private=false${prompt ? `&prompt=${encodeURIComponent(prompt)}` : ''}`);
};
