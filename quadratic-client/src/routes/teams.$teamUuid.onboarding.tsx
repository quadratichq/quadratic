import { AGENT_MODE_KEY } from '@/app/atoms/agentModeAtom';
import { authClient } from '@/auth/auth';
import { OnboardingResponseV2Schema } from '@/dashboard/onboarding/onboardingSchema';
import { Questions, questionsById } from '@/dashboard/onboarding/Questions';
import { apiClient } from '@/shared/api/apiClient';
import { ROUTES } from '@/shared/constants/routes';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { registerEventAnalyticsData, trackEvent } from '@/shared/utils/analyticsEvents';
import { captureException, flush } from '@sentry/react';
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
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);

  // Allow skipping onboarding with ?skip
  if (searchParams.has('skip')) {
    const teamUuid = params.teamUuid || '';

    // Mark the team as having completed onboarding
    await apiClient.teams.update(teamUuid, {
      onboardingResponses: {
        __version: 2,
        __createdAt: new Date().toISOString(),
        skipped: true,
      },
    });

    // Redirect to create a new file, same as after completing onboarding
    const newFilePath = ROUTES.CREATE_FILE(teamUuid, { private: false });
    return redirectDocument(newFilePath);
  }

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

  const currentQuestionNumber = currentIndex + 1;
  const currentQuestionsTotal = currentQuestionStackIds.length;

  const user = await authClient.user();

  const out = {
    currentId,
    currentIndex,
    currentQuestionStackIds,
    currentQuestionNumber,
    currentQuestionsTotal,
    isLastQuestion: currentQuestionStackIds.indexOf(currentId) === currentQuestionStackIds.length - 1,
    username: user?.name || '',
  };
  return out;
};

type OnboardingLoaderData = {
  currentId: string;
  currentIndex: number;
  currentQuestionStackIds: string[];
  currentQuestionNumber: number;
  currentQuestionsTotal: number;
  isLastQuestion: boolean;
  username: string;
};

export const useOnboardingLoaderData = () => {
  return useLoaderData() as OnboardingLoaderData;
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
  const teamUuid = params.teamUuid || '';

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
      if (value !== '') {
        if (!formJson[key]) formJson[key] = [];
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

  // Save the responses to the server and mixpanel and log any errors
  const sentryPromises: Promise<unknown>[] = [];

  if (result.success) {
    try {
      // If there are invites, yeet them off to the server.
      const inviteEmails = result.data['team-invites[]'] ? result.data['team-invites[]'].map((email) => email) : [];
      const uploadInvitesPromise = inviteEmails.map((email) =>
        apiClient.teams.invites.create(teamUuid, { email, role: 'EDITOR' })
      );
      // Upload the responses and the team name
      const uploadResponsesPromise = apiClient.teams.update(teamUuid, {
        onboardingResponses: result.data,
        name: result.data['team-name'],
      });
      // Also send everything to Mixpanel
      const uploadResponsesToMixpanelPromise = trackEvent('[Onboarding].submit', result.data);
      const [serverResult, mixpanelResult] = await Promise.allSettled([
        uploadResponsesPromise,
        uploadResponsesToMixpanelPromise,
        uploadInvitesPromise,
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

  // A/B test: 50% of new users start with agent mode ON, 50% with agent mode OFF
  const startWithAgentModeOn = Math.random() < 0.5;
  trackEvent('[Onboarding].postOnboardingFlow', {
    flow: startWithAgentModeOn ? 'startWithAgentModeOn' : 'startWithAgentModeOff',
  });

  // Register as super property so we can filter/analyze sessions for users in the agent mode cohort.
  // Naming convention: ab_<test-name>_<month><year> with values for each variant.
  registerEventAnalyticsData({
    ab_agent_mode_jan2026: startWithAgentModeOn ? 'startWithAgentModeOn' : 'startWithAgentModeOff',
  });

  // Set agent mode in localStorage before redirecting
  localStorage.setItem(AGENT_MODE_KEY, String(startWithAgentModeOn));

  const newFilePath = ROUTES.CREATE_FILE(teamUuid, { private: false });

  // If the user wants to upgrade to Pro, we'll send them to Stripe first
  if (result.data && result.data['team-plan'] === 'pro') {
    // Send them back to the last step of onboarding if they cancel
    const redirectUrlCancel = new URL(window.location.href);
    redirectUrlCancel.searchParams.delete('team-plan');
    const { url } = await apiClient.teams.billing.getCheckoutSessionUrl(
      teamUuid,
      window.location.origin + newFilePath,
      redirectUrlCancel.href
    );
    return redirectDocument(url);
  }

  // Otherwise, hard-redirect user to a new file
  return redirectDocument(newFilePath);
};
