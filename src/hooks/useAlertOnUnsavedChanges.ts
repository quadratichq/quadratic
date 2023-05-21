import { useEffect } from 'react';

function beforeUnloadListener(event: Event) {
  event.preventDefault();
  event.returnValue = false;
}

export default function useAlertOnUnsavedChanges(hasUnsavedChanges: boolean) {
  useEffect(() => {
    console.log('hasUnsavedChanges', hasUnsavedChanges);
    if (hasUnsavedChanges) {
      window.addEventListener('beforeunload', beforeUnloadListener);
      return;
    }
    window.removeEventListener('beforeunload', beforeUnloadListener);
    return () => window.removeEventListener('beforeunload', beforeUnloadListener);
  }, [hasUnsavedChanges]);
}
