import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { filesImportSettingsAtom } from '@/dashboard/atoms/filesImportSettingsAtom';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/shadcn/ui/alert-dialog';
import { Button } from '@/shared/shadcn/ui/button';
import { Checkbox } from '@/shared/shadcn/ui/checkbox';
import { Input } from '@/shared/shadcn/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/shadcn/ui/select';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/shared/shadcn/ui/table';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilCallback, useRecoilValue } from 'recoil';

export const ImportSettings = () => {
  const [csvDelimiter, setCsvDelimiter] = useState<string>(',');
  const [customCsvDelimiter, setCustomCsvDelimiter] = useState<string>('');
  const [csvPreview, setCsvPreview] = useState<string[][] | undefined>(undefined);
  const [hasHeader, setHasHeader] = useState<boolean>(true);
  const { csvFile, callbackFn } = useRecoilValue(filesImportSettingsAtom);

  const handleSubmit = useRecoilCallback(
    ({ set }) =>
      () => {
        set(filesImportSettingsAtom, (prev) => {
          const delimiter = csvDelimiter === 'custom' ? customCsvDelimiter : csvDelimiter;
          prev.callbackFn?.({
            csvDelimiter: delimiter.length === 1 ? delimiter.charCodeAt(0) : undefined,
            hasHeader,
          });

          return {
            callbackFn: undefined,
          };
        });
      },
    [csvDelimiter, customCsvDelimiter, hasHeader, setCsvDelimiter, setCustomCsvDelimiter]
  );

  const inputRef = useCallback((node: HTMLInputElement) => {
    if (node) {
      setTimeout(() => node.focus(), 100);
    }
  }, []);

  const getPreview = useCallback(
    async (abortSignal: AbortSignal) => {
      setCsvPreview(undefined);
      if (!csvFile) return;
      try {
        const delimiter = csvDelimiter === 'custom' ? customCsvDelimiter.charCodeAt(0) : csvDelimiter.charCodeAt(0);
        if (isNaN(delimiter)) return;

        const arrayBuffer = await csvFile.arrayBuffer();
        const { preview } = await quadraticCore.getCSVPreview({ file: arrayBuffer, delimiter });

        if (!abortSignal.aborted) {
          setCsvPreview(preview);
        }
      } catch (error) {
        setCsvPreview(undefined);
        console.error(error);
      }
    },
    [csvFile, csvDelimiter, customCsvDelimiter]
  );

  useEffect(() => {
    const abortController = new AbortController();
    getPreview(abortController.signal);
    return () => abortController.abort();
  }, [getPreview]);

  if (!callbackFn) return null;

  return (
    <AlertDialog open={true}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Import settings</AlertDialogTitle>
        </AlertDialogHeader>

        <div className="flex flex-row items-center justify-between gap-12">
          <div className="w-1/2 text-sm font-semibold">CSV delimiter</div>

          <div className="flex w-1/2 flex-row items-center gap-2">
            <Select
              defaultValue={csvDelimiter}
              value={csvDelimiter}
              required={true}
              onValueChange={(value) => setCsvDelimiter(value)}
            >
              <SelectTrigger
                autoFocus={csvDelimiter !== 'custom'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              >
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
                ref={inputRef}
                className="w-[34px]"
                autoFocus={true}
                type="text"
                minLength={1}
                maxLength={1}
                value={customCsvDelimiter}
                onChange={(e) => {
                  const value = e.target.value;
                  const charCode = value.charCodeAt(0);
                  // ensure u8 char code
                  if (value === '' || (charCode >= 0 && charCode <= 255)) {
                    setCustomCsvDelimiter(value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
            )}
          </div>
        </div>

        <div className="flex flex-row items-center gap-2">
          <Checkbox
            checked={hasHeader}
            onCheckedChange={(checked) => {
              if (checked === 'indeterminate') {
                setHasHeader(false);
              } else {
                setHasHeader(checked);
              }
            }}
          />
          <span className="text-sm font-semibold">First row contains headings</span>
        </div>

        {csvPreview && (
          <Table>
            <TableCaption>CSV preview</TableCaption>
            {hasHeader && csvPreview.length > 0 && (
              <TableHeader>
                <TableRow>
                  {csvPreview[0].map((cell, i) => (
                    <TableHead key={`header-${i}-${cell}`}>{cell}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
            )}
            <TableBody>
              {csvPreview.slice(hasHeader ? 1 : 0).map((row, i) => (
                <TableRow key={`row-${i}-${row[0]}`}>
                  {row.map((cell, j) => (
                    <TableCell key={`cell-${j}-${cell}`}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

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
