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
import { Input } from '@/shared/shadcn/ui/input';
import { Label } from '@/shared/shadcn/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/shadcn/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/shadcn/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/shadcn/ui/table';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilCallback, useRecoilValue } from 'recoil';

const DEFAULT_CSV_DELIMITER = ',';
const DEFAULT_CUSTOM_CSV_DELIMITER = '';
const DEFAULT_HAS_HEADING = true;
const DEFAULT_CSV_PREVIEW = undefined;
const DEFAULT_MAX_ROWS = 6; // 1 header + 5 rows

export const CSVImportSettings = () => {
  const [csvDelimiter, setCsvDelimiter] = useState<string>(DEFAULT_CSV_DELIMITER);
  const [customCsvDelimiter, setCustomCsvDelimiter] = useState<string>(DEFAULT_CUSTOM_CSV_DELIMITER);
  const [hasHeading, setHasHeading] = useState<boolean>(DEFAULT_HAS_HEADING);
  const [csvPreview, setCsvPreview] = useState<string[][] | undefined>(DEFAULT_CSV_PREVIEW);
  const { csvFile, submitFn } = useRecoilValue(filesImportSettingsAtom);

  const handleSubmit = useRecoilCallback(
    ({ set }) =>
      () => {
        if (csvDelimiter === 'custom' && customCsvDelimiter.length !== 1) return;

        set(filesImportSettingsAtom, (prev) => {
          const delimiter = csvDelimiter === 'custom' ? customCsvDelimiter : csvDelimiter;
          prev.submitFn?.({
            csvDelimiter: delimiter.length === 1 ? delimiter.charCodeAt(0) : undefined,
            hasHeading,
          });

          setCsvPreview(undefined);

          return {
            csvFile: undefined,
            submitFn: undefined,
            cancelFn: undefined,
          };
        });
      },
    [csvDelimiter, customCsvDelimiter, hasHeading, setCsvDelimiter, setCustomCsvDelimiter]
  );

  const handleCancel = useRecoilCallback(({ set }) => () => {
    set(filesImportSettingsAtom, (prev) => {
      prev.cancelFn?.();

      // Reset local state
      setCsvDelimiter(DEFAULT_CSV_DELIMITER);
      setCustomCsvDelimiter(DEFAULT_CUSTOM_CSV_DELIMITER);
      setHasHeading(DEFAULT_HAS_HEADING);
      setCsvPreview(DEFAULT_CSV_PREVIEW);

      return {
        csvFile: undefined,
        submitFn: undefined,
        cancelFn: undefined,
      };
    });
  });

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

        const file = await csvFile.arrayBuffer();

        quadraticCore.initWorker();
        const preview = await quadraticCore.getCsvPreview({
          file,
          maxRows: DEFAULT_MAX_ROWS,
          delimiter,
        });

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

  if (!submitFn) return null;

  return (
    <AlertDialog open={true}>
      <AlertDialogContent
        className="max-w-[80%] select-none"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleSubmit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            handleCancel();
          }
        }}
      >
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
              <SelectTrigger autoFocus={csvDelimiter !== 'custom'}>
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
          <>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">CSV preview</p>
            <div className="overflow-hidden rounded border border-border">
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
                    csvPreview.slice(hasHeading ? 1 : 0, DEFAULT_MAX_ROWS + (hasHeading ? 0 : -1)).map((row, i) => (
                      <TableRow key={`row-${i}-${row[0]}`}>
                        {row.map((cell, j) => (
                          <TableCell key={`cell-${j}-${cell}`}>{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => handleCancel()}>
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
    <div className="flex flex-row items-center gap-12">
      <div className="w-52 text-sm font-semibold">{label}</div>

      <div className="flex max-w-52 flex-grow flex-row items-center gap-2">{children}</div>
    </div>
  );
}
