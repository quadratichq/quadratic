import { useInterval } from '../hooks/useInterval';
import { useGlobalSnackbar } from './GlobalSnackbarProvider';

export const UpgradeApp = () => {
  const { addGlobalSnackbar } = useGlobalSnackbar();

  useInterval(
    () => {
      fetch('/')
        .then((res) => res.text())
        .then((html) => {
          const parser = new DOMParser();
          const dom = parser.parseFromString(html, 'text/html');

          const selector = "meta[name='version']";
          const nextVersion = dom.querySelector(selector)?.getAttribute('content');
          const currentVersion = document.querySelector(selector)?.getAttribute('content');

          if (!(nextVersion && currentVersion)) {
            // TODO fire event to sentry noting that versions aren't in the right place
            return;
          }

          const needsUpdate = currentVersion !== nextVersion;
          console.log(
            '[<UpgradeApp>] needs update? %s | current version: %s | next version: %s',
            needsUpdate,
            currentVersion,
            nextVersion
          );
          if (needsUpdate) {
            // TODO pass custom actions to snackbar so the page will refresh
            addGlobalSnackbar('Quadratic has updates! Please reload.');
          }
        });
    },
    10000 // one hour? 3_600_000
  );

  return null;
};
