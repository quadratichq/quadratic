import { filesImportSettingsAtom } from '@/dashboard/atoms/filesImportSettingsAtom';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/shadcn/ui/alert-dialog';
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
    <AlertDialog open={true}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Import settings</AlertDialogTitle>
        </AlertDialogHeader>

        <div className="flex flex-row items-center justify-between gap-12">
          <div className="w-1/2 text-sm font-semibold">CSV delimiter</div>

          <div className="flex w-1/2 flex-row items-center gap-2">
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

        <AlertDialogFooter>
          <Button
            variant="default"
            onClick={() => handleSubmit()}
            disabled={csvDelimiter === 'custom' && customCsvDelimiter.length !== 1}
          >
            Submit
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
