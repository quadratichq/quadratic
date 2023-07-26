import { useEffect } from 'react';

function beforeUnloadListener(event: Event) {
  event.preventDefault();
  event.returnValue = false;
}

function sendToElectronHasUnsavedChanges(hasUnsavedChanges: boolean) {
  //@ts-expect-error
  if (window.electronAPI) window.electronAPI.editorHasUnsavedChanges(hasUnsavedChanges);
}

export default function useAlertOnUnsavedChanges(hasUnsavedChanges: boolean | undefined) {
  useEffect(() => {
    if (hasUnsavedChanges) {
      window.addEventListener('beforeunload', beforeUnloadListener);
      sendToElectronHasUnsavedChanges(true);
    } else {
      window.removeEventListener('beforeunload', beforeUnloadListener);
      sendToElectronHasUnsavedChanges(false);
    }

    return () => {
      window.removeEventListener('beforeunload', beforeUnloadListener);
      sendToElectronHasUnsavedChanges(false);
    };
  }, [hasUnsavedChanges]);
}
