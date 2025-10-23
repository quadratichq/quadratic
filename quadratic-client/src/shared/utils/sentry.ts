import {
  browserProfilingIntegration,
  browserSessionIntegration,
  browserTracingIntegration,
  captureConsoleIntegration,
  extraErrorDataIntegration,
  getReplay,
  httpClientIntegration,
  init,
  replayCanvasIntegration,
  replayIntegration,
  zodErrorsIntegration,
} from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;
const environment = import.meta.env.VITE_ENVIRONMENT ?? 'development';
const version = import.meta.env.VITE_VERSION;
export const SENTRY_REPLAY_KEY = 'enableSentryReplay';

/**
 * A few notes:
 *
 * Replays w/canvas only seem to work if you do it on initialization (i.e.
 * you can't lazy load the integration via `.addIntegration()`).
 *
 * https://github.com/getsentry/sentry-javascript/issues/13754
 *
 * Because whether we do replays is dependent on a team preference, we store that
 * info in localStorage and then stop the recording if we find out the user's
 * preference
 *
 * So the logic goes like this:
 *
 * - When the app loads the very first time, see if there's a preference in localStorage.
 * - If there's not, start the recording. Then when we load team data and find out
 *   they have a preference to not record, we'll stop it.
 * - If there is a preference, we'll use that. And if we find out later they changed it,
 *   we'll update localstorage and stop the recording.
 *
 * The two main paths into the app (dashboard and the file) are the two routes
 * where we'll run this logic.
 */

export const initSentry = () => {
  let useReplay = true;
  if (localStorage.getItem(SENTRY_REPLAY_KEY) === 'false') {
    useReplay = false;
  }

  try {
    if (dsn && dsn !== 'none') {
      init({
        dsn,
        environment,
        release: `quadratic@${version}`,
        replaysSessionSampleRate: 1.0,
        replaysOnErrorSampleRate: 1.0,
        integrations: [
          browserProfilingIntegration(),
          browserSessionIntegration(),
          browserTracingIntegration(),
          captureConsoleIntegration({ levels: ['error', 'warn'] }),
          extraErrorDataIntegration(),
          httpClientIntegration(),
          zodErrorsIntegration(),
          ...(useReplay
            ? [
                replayIntegration({
                  maskAllText: false,
                  blockAllMedia: false,
                  networkDetailDenyUrls: ['/iframe-indexeddb'],
                }),
                replayCanvasIntegration({ enableManualSnapshot: false, quality: 'high' }),
              ]
            : []),
        ],
        profilesSampleRate: 1.0,
        tracesSampleRate: 1.0,
      });
    }
  } catch (error) {
    console.error('Error initializing Sentry', error);
  }
};

const stopRecording = () => {
  const replay = getReplay();
  if (replay) {
    replay.stop();
  }
};

export const handleSentryReplays = (useReplayPreferenceFromServer: boolean) => {
  // Get the current preference on the client
  const currentPreference = localStorage.getItem(SENTRY_REPLAY_KEY);

  // If it's never been set, we'll set it and stop the recording if it doesn't match the server preference
  if (currentPreference === null) {
    localStorage.setItem(SENTRY_REPLAY_KEY, useReplayPreferenceFromServer ? 'true' : 'false');
    if (useReplayPreferenceFromServer === false) {
      stopRecording();
    }
    return;
  }

  // If it has been set, we'll use that
  const useReplayFromClient = currentPreference === 'true';

  // If the preference is different from the server, we'll set it
  if (useReplayFromClient !== useReplayPreferenceFromServer) {
    localStorage.setItem(SENTRY_REPLAY_KEY, useReplayPreferenceFromServer ? 'true' : 'false');

    // And if they changed it to not record, we'll stop it
    if (useReplayPreferenceFromServer === false) {
      stopRecording();
    }
    return;
  }

  // Otherwise, do nothing
};
