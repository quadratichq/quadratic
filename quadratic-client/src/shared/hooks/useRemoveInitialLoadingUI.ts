import { useEffect } from 'react';

export const useRemoveInitialLoadingUI = () => {
  useEffect(() => {
    document.documentElement.removeAttribute('data-is-loading');
  }, []);
};
