import { OnboardingResponseV2Schema } from '@/dashboard/onboarding/onboardingSchema';
import { Questions, questionsById } from '@/dashboard/onboarding/Questions';
import { apiClient } from '@/shared/api/apiClient';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { captureException, flush } from '@sentry/react';
import { useEffect } from 'react';
import { redirectDocument, useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router';
import { RecoilRoot } from 'recoil';

/**
 * TODO: refactor this.
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
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  const currentUse = searchParams.get('use');
  const uniqueKeys = new Set(Array.from(searchParams.keys()).filter((key) => !key.endsWith('-other')));
  const currentQuestionStackIds = Object.entries(questionsById)
    .filter(([id, { excludeForUse }]) => {
      if (excludeForUse) {
        return !excludeForUse.includes(currentUse ?? '');
      }
      return true;
    })
    .map(([id]) => id);
  const currentIndex = uniqueKeys.size;
  const currentId = currentQuestionStackIds[currentIndex]
    ? currentQuestionStackIds[currentIndex]
    : Object.keys(questionsById)[0];

  const currentQuestionNumber = currentIndex + 1; // currentQuestionStackIds.length > 0 ? currentQuestionStackIds.indexOf(currentId) + 1 : 1;
  const currentQuestionsTotal = currentQuestionStackIds.length;

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
  useEffect(() => {
    trackEvent('[Onboarding].loaded');
  }, []);

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
export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { teamUuid } = params as { teamUuid: string };
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
  const result = OnboardingResponseV2Schema.safeParse({
    __version: 2,
    __createdAt: new Date().toISOString(),
    ...formJson,
  });

  // TODO: pick out name and other things

  // Save the responses to the server and mixpanel and log any errors
  const sentryPromises: Promise<unknown>[] = [];

  if (result.success) {
    try {
      // TODO: handle invites
      const inviteEmails = result.data['team-invites[]'] ? result.data['team-invites[]'].map((email) => email) : [];
      const invitePromises = inviteEmails.map((email) =>
        apiClient.teams.invites.create(teamUuid, { email, role: 'EDITOR' })
      );

      // const uploadToServerPromise = apiClient.user.update({ onboardingResponses: result.data });

      const uploadToServerPromise = apiClient.teams.update(teamUuid, {
        onboardingResponses: result.data,
        name: result.data['team-name'],
      });
      const uploadToMixpanelPromise = trackEvent('[Onboarding].submit', result.data);
      const [serverResult, mixpanelResult] = await Promise.allSettled([
        uploadToServerPromise,
        uploadToMixpanelPromise,
        invitePromises,
      ]);

      if (serverResult.status === 'rejected') {
        captureException({
          message: 'Failed to upload user onboarding responses to server',
          level: 'error',
          extra: {
            error: serverResult.reason,
          },
        });
        sentryPromises.push(flush(2000));
      }

      if (mixpanelResult.status === 'rejected') {
        captureException({
          message: 'Failed to upload user onboarding responses to Mixpanel',
          level: 'error',
          extra: {
            error: mixpanelResult.reason,
          },
        });
        sentryPromises.push(flush(2000));
      }
    } catch (error) {
      captureException({
        message: 'Unexpected error during onboarding submission',
        level: 'error',
        extra: {
          error,
        },
      });
      sentryPromises.push(flush(2000));
    }
  } else {
    // This should never happen in prod. If it does, that's a bug and we'll send to Sentry
    captureException({
      message: 'Invalid onboarding payload. This is a developer bug.',
      level: 'error',
      extra: {
        error: result.error,
      },
    });
    sentryPromises.push(flush(2000));
  }

  if (sentryPromises.length > 0) {
    await Promise.all(sentryPromises).catch(console.error);
  }

  console.log(result.data);
  await new Promise((resolve) => setTimeout(resolve, 2000));

  if (result.data && result.data['team-plan'] === 'pro') {
    // TODO: 'back' doing (-1) messes up if we go stripe -> onboarding -> stripe
    // If we want to have success/cancel callbacks, we'll have to build support
    // Otherwise, we can just redirect to new file
    const redirectUrlCancel = new URL(window.location.href);
    redirectUrlCancel.searchParams.delete('team-plan');
    const { url } = await apiClient.teams.billing.getCheckoutSessionUrl(
      teamUuid,
      window.location.origin + `/files/create?private=false`,
      redirectUrlCancel.href
    );
    return redirectDocument(url);
  }

  // TODO: handle redirect to stripe if necessary
  // Hard-redirect user to a new file
  return redirectDocument(`/files/create?private=false`);
};
