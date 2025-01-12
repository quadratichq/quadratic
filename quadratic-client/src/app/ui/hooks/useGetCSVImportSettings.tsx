import type { FileImportSettings } from '@/dashboard/atoms/filesImportSettingsAtom';
import { filesImportSettingsAtom } from '@/dashboard/atoms/filesImportSettingsAtom';
import { useRecoilCallback } from 'recoil';

export const useGetCSVImportSettings = () => {
  const getCSVImportSettings = useRecoilCallback(
    ({ set }) =>
      (csvFile: File): Promise<FileImportSettings> => {
        return new Promise((resolve, reject) => {
          set(filesImportSettingsAtom, () => ({
            csvFile: csvFile,
            submitFn: (settings) => {
              resolve(settings);
            },
            cancelFn: () => {
              reject(new Error('Cancelled'));
            },
          }));
        });
      },
    []
  );

  return { getCSVImportSettings };
};
