import { apiClient } from '@/shared/api/apiClient';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { useEffect, useMemo } from 'react';

export const useUserDataKv = () => {
  // "Did you know?" popover for the model picker
  // 1. Get the initial state from the server
  // 2. Save the initial state in local storage
  // 3. If the state changes from false to true, update localstorage and the server
  // We do it this way because the client state is not being synced with the
  // server state through the router.
  // So we keep track of it ourselves and then if the page is ever reloaded,
  // we'll get the freshest state.
  const fileRouteData = useFileRouteLoaderData();
  const clientDataKv = fileRouteData?.userMakingRequest?.clientDataKv;
  const initialKnowsAboutModelPicker = useMemo(() => Boolean(clientDataKv?.knowsAboutModelPicker), [clientDataKv]);

  const [knowsAboutModelPicker, setKnowsAboutModelPicker] = useLocalStorage(
    'knowsAboutModelPicker',
    initialKnowsAboutModelPicker
  );

  useEffect(() => {
    if (initialKnowsAboutModelPicker === false && knowsAboutModelPicker) {
      apiClient.user.clientDataKv.update({ knowsAboutModelPicker: true });
    }
  }, [initialKnowsAboutModelPicker, knowsAboutModelPicker]);

  return {
    knowsAboutModelPicker,
    setKnowsAboutModelPicker,
  };
};
