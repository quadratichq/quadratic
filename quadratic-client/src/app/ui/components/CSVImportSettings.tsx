import { GridControllerWasm } from '@/app/quadratic-rust-client/quadratic_rust_client';
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
import { Label } from '@/shared/shadcn/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/shadcn/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/shadcn/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/shadcn/ui/table';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilCallback, useRecoilValue, useResetRecoilState } from 'recoil';

export const CSVImportSettings = () => {
  const [csvDelimiter, setCsvDelimiter] = useState<string>(',');
  const [customCsvDelimiter, setCustomCsvDelimiter] = useState<string>('');
  const [csvPreview, setCsvPreview] = useState<string[][] | undefined>(undefined);
  const [hasHeading, setHasHeading] = useState<boolean>(true);
  const { csvFile, callbackFn } = useRecoilValue(filesImportSettingsAtom);

  const handleSubmit = useRecoilCallback(
    ({ set }) =>
      () => {
        set(filesImportSettingsAtom, (prev) => {
          const delimiter = csvDelimiter === 'custom' ? customCsvDelimiter : csvDelimiter;
          prev.callbackFn?.({
            csvDelimiter: delimiter.length === 1 ? delimiter.charCodeAt(0) : undefined,
            hasHeading,
          });

          return {
            callbackFn: undefined,
          };
        });
      },
    [csvDelimiter, customCsvDelimiter, hasHeading, setCsvDelimiter, setCustomCsvDelimiter]
  );

  const handleCancel = useResetRecoilState(filesImportSettingsAtom);

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
        const preview = GridControllerWasm.getCSVPreview(new Uint8Array(arrayBuffer), delimiter);

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

        <Row label="CSV delimiter">
          <>
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
          </>
        </Row>

        <Row label="First row contains headings?">
          <RadioGroup
            onValueChange={(value) => {
              setHasHeading(value === 'yes');
            }}
            value={hasHeading ? 'yes' : 'no'}
            className="flex flex-row items-center gap-6"
          >
            <Label className="flex flex-row items-center gap-2 py-2">
              <RadioGroupItem value="yes" id="yes" />
              Yes
            </Label>

            <Label htmlFor="no" className="flex flex-row items-center gap-2 py-2">
              <RadioGroupItem value="no" id="no" /> No
            </Label>
          </RadioGroup>
        </Row>

        {csvPreview && (
          <div className="overflow-hidden rounded border border-border">
            <p className="border-b border-border bg-accent py-1 text-center text-xs text-muted-foreground">
              CSV preview
            </p>
            <Table>
              {hasHeading && csvPreview.length > 0 && (
                <TableHeader>
                  <TableRow>
                    {csvPreview[0].map((cell, i) => (
                      <TableHead key={`header-${i}-${cell}`}>{cell}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
              )}

              <TableBody>
                {csvPreview.length > 0 &&
                  csvPreview.slice(hasHeading ? 1 : 0).map((row, i) => (
                    <TableRow key={`row-${i}-${row[0]}`}>
                      {row.map((cell, j) => (
                        <TableCell key={`cell-${j}-${cell}`}>{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        )}

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => handleCancel()}
            disabled={csvDelimiter === 'custom' && customCsvDelimiter.length !== 1}
          >
            Cancel
          </Button>
          <Button
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-row items-center justify-between gap-12">
      <div className="w-1/2 text-sm font-semibold">{label}</div>

      <div className="flex w-1/2 flex-row items-center gap-2">{children}</div>
    </div>
  );
}
