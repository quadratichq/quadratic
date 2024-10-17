import { FileImportSettings, filesImportSettingsAtom } from '@/dashboard/atoms/filesImportSettingsAtom';
import { useRecoilCallback } from 'recoil';

export const useGetCsvDelimiter = () => {
  const getCsvDelimiter = useRecoilCallback(
    ({ set }) =>
      (csvFile: File): Promise<FileImportSettings> => {
        return new Promise((resolve) => {
          set(filesImportSettingsAtom, () => ({
            callbackFn: (settings) => {
              resolve(settings);
            },
            csvFile: csvFile,
          }));
        });
      },
    []
  );

  return { getCsvDelimiter };
};
