import { requireAuth } from '@/auth/auth';
import {
  allQuestions,
  OnboardingResponseV1Schema,
  Questions,
  type OnboardingResponseV1,
} from '@/dashboard/onboarding/Questions';
import { apiClient } from '@/shared/api/apiClient';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import * as Sentry from '@sentry/react';
import mixpanel from 'mixpanel-browser';
import { useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router';
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
  const currentQuestionStack = currentUse
    ? allQuestions.filter((q) => (q.appliesToUse ? q.appliesToUse === currentUse : true))
    : [];
  const currentIndex = uniqueKeys.size;
  const currentId = currentUse
    ? currentQuestionStack[currentIndex]
      ? currentQuestionStack[currentIndex].id
      : currentQuestionStack[currentIndex - 1].id
    : 'use';

  return {
    currentId,
    currentIndex: currentIndex,
    currentQuestionStack,
    isLastQuestion: currentId === allQuestions[allQuestions.length - 1].id,
  };
};

export const useOnboardingLoaderData = () => {
  return useLoaderData() as Awaited<ReturnType<typeof loader>>;
};

export const Component = () => {
  useRemoveInitialLoadingUI();
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
  const result = OnboardingResponseV1Schema.safeParse({ __version: 1, ...formJson });

  // Save the responses to the server and mixpanel and log any errors
  const sentryPromises: Promise<unknown>[] = [];
  let prompt = '';
  if (result.success) {
    prompt = getPrompt(result.data);
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

  // Hard-redirect user to a new file
  window.location.href = prompt
    ? `/files/create?private=false&prompt=${encodeURIComponent(prompt)}`
    : '/files/create?private=false';
  return null;
};

function getPrompt(data: OnboardingResponseV1) {
  let prompt = '';
  if (data.use === 'work' && data['work-role'] && data['work-role'] !== 'other') {
    const optionValue = data['work-role'];
    const label = allQuestions.find((q) => q.id === 'work-role')?.options.find((o) => o.value === optionValue)?.label;
    if (label)
      prompt = `I work in ${label}; create me a sample dataset for that field. Once finished with the dataset, create a chart that helps explain the data.`;
  } else if (data.use === 'personal' && data['personal-uses[]'] && data['personal-uses[]'].length > 0) {
    const optionValue = data['personal-uses[]'][0];
    const label = allQuestions
      .find((q) => q.id === 'personal-uses[]')
      ?.options.find((o) => o.value === optionValue)?.label;
    if (label)
      prompt = `One of the things I'm planning on using Quadratic for is ${label}; create me a sample dataset for that field. Once finished with the dataset, create a chart that helps explain the data.`;
  } else if (
    data.use === 'education' &&
    data['education-identity'] &&
    data['education-identity'] !== 'other' &&
    data['education-subjects[]'] &&
    data['education-subjects[]'].length > 0
  ) {
    const optionValueIdentity = data['education-identity'];
    const labelIdentity = allQuestions
      .find((q) => q.id === 'education-identity')
      ?.options.find((o) => o.value === optionValueIdentity)?.label;
    const optionValueSubject = data['education-subjects[]'][0];
    const labelSubject = allQuestions
      .find((q) => q.id === 'education-subjects')
      ?.options.find((o) => o.value === optionValueSubject)?.label;
    if (labelIdentity && labelSubject)
      prompt = `I’m a ${labelIdentity} and one of the areas I’m working in is ${labelSubject}; create me a sample dataset for my field. Once finished with the dataset, create a chart that helps explain the data.`;
  }
  return prompt;
}
