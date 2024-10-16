import { filesImportSettingsAtom } from '@/dashboard/atoms/filesImportSettingsAtom';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/shadcn/ui/select';
import { useState } from 'react';
import { useRecoilCallback, useRecoilValue } from 'recoil';

export const ImportSettings = () => {
  const [csvDelimiter, setCsvDelimiter] = useState<string>(',');
  const [customCsvDelimiter, setCustomCsvDelimiter] = useState<string>('');
  const importSettings = useRecoilValue(filesImportSettingsAtom);

  const handleSubmit = useRecoilCallback(
    ({ set }) =>
      () => {
        set(filesImportSettingsAtom, (prev) => {
          const delimiter = csvDelimiter === 'custom' ? customCsvDelimiter : csvDelimiter;
          prev.callbackFn?.({
            csvDelimiter: delimiter.length === 1 ? delimiter.charCodeAt(0) : undefined,
          });

          return {
            callbackFn: undefined,
          };
        });
        setCsvDelimiter(',');
        setCustomCsvDelimiter('');
      },
    [csvDelimiter, customCsvDelimiter, setCsvDelimiter, setCustomCsvDelimiter]
  );

  if (!importSettings.callbackFn) return null;

  return (
    <div className="absolute left-0 top-0 z-10 flex h-full w-full flex-col items-center overflow-hidden bg-white bg-opacity-90">
      <div className="z-10 mb-12 mt-12 w-[565px] select-none rounded-sm border border-slate-200 bg-white p-6 tracking-tight shadow-[0_4px_8px_0px_rgba(0,0,0,0.15)]">
        <div className="pb-4 text-lg font-semibold">Import settings</div>

        <div className="flex w-full flex-col overflow-y-auto">
          <div className="m-1 flex flex-row items-center justify-between gap-12">
            <div className="min-w-fit text-sm font-semibold">CSV delimiter</div>

            <div className="flex w-full flex-row items-center gap-2">
              <Select defaultValue="," required={true} onValueChange={(value) => setCsvDelimiter(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a delimiter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=",">Comma</SelectItem>
                  <SelectItem value=";">Semicolon</SelectItem>
                  <SelectItem value="\t">Tab</SelectItem>
                  <SelectItem value="|">Pipe</SelectItem>
                  <SelectItem value=":">Colon</SelectItem>
                  <SelectItem value=" ">Space</SelectItem>
                  <SelectItem value="auto">Auto detect</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>

              {csvDelimiter === 'custom' && (
                <Input
                  className="w-8"
                  type="text"
                  minLength={1}
                  maxLength={1}
                  value={customCsvDelimiter}
                  onChange={(e) => setCustomCsvDelimiter(e.target.value)}
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            variant="default"
            onClick={() => handleSubmit()}
            disabled={csvDelimiter === 'custom' && customCsvDelimiter.length !== 1}
          >
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
};
