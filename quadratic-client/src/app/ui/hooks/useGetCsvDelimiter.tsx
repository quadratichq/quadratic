import { filesImportSettingsAtom } from '@/dashboard/atoms/filesImportSettingsAtom';
import { useRecoilCallback } from 'recoil';

export const useGetCsvDelimiter = () => {
  const getCsvDelimiter = useRecoilCallback(
    ({ set }) =>
      (): Promise<number | undefined> => {
        return new Promise((resolve) => {
          set(filesImportSettingsAtom, () => ({
            callbackFn: (settings) => {
              resolve(settings.csvDelimiter);
            },
          }));
        });
      },
    []
  );

  return { getCsvDelimiter };
};
