import { getExtension, stripExtension } from '@/app/helpers/files';
import type { FileImportProgress } from '@/dashboard/atoms/filesImportProgressAtom';
import { filesImportProgressAtom } from '@/dashboard/atoms/filesImportProgressAtom';
import { filesImportProgressListAtom } from '@/dashboard/atoms/filesImportProgressListAtom';
import { ROUTES } from '@/shared/constants/routes';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/shadcn/ui/alert-dialog';
import { Button } from '@/shared/shadcn/ui/button';
import { Progress } from '@/shared/shadcn/ui/progress';
import { cn } from '@/shared/shadcn/utils';
import { memo, useCallback, useMemo } from 'react';
import { Link } from 'react-router';
import { useRecoilState } from 'recoil';

export const ImportProgressList = memo(() => {
  const [{ show }, setShow] = useRecoilState(filesImportProgressListAtom);
  const [{ importing, files, currentFileIndex }, setFilesImportProgressState] = useRecoilState(filesImportProgressAtom);

  const handleClose = useCallback(() => {
    setShow({ show: false });
    setFilesImportProgressState({
      importing: false,
      createNewFile: false,
      currentFileIndex: undefined,
      files: [],
    });
  }, [setFilesImportProgressState, setShow]);

  if (!show || currentFileIndex === undefined) return;

  return (
    <AlertDialog open={true}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Import files</AlertDialogTitle>
          <AlertDialogDescription></AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex max-h-[75vh] w-full flex-col overflow-y-auto">
          {files.map((file, index) => (
            <ImportProgressItem
              file={file}
              index={index}
              current={currentFileIndex ?? 0}
              importing={importing}
              key={index}
              onOpen={handleClose}
            />
          ))}
        </div>

        <AlertDialogFooter>
          <Button disabled={importing} onClick={handleClose}>
            Close
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});

const ImportProgressItem = memo(
  ({
    file,
    index,
    current,
    importing,
    onOpen,
  }: {
    file: FileImportProgress;
    index: number;
    current: number;
    importing: boolean;
    onOpen: () => void;
  }) => {
    const fileName = useMemo(() => stripExtension(file.name), [file.name]);
    const extension = useMemo(() => getExtension(file.name), [file.name]);
    const progress = useMemo(() => Math.round(file.progress), [file.progress]);

    const state = useMemo(
      () =>
        file.step === 'error'
          ? 'Import failed'
          : file.step === 'cancel'
            ? 'Import canceled'
            : file.step === 'done'
              ? 'Imported'
              : file.step === 'read' && current < index
                ? 'Pending...'
                : 'Importing...',
      [file.step, current, index]
    );

    const disabled = useMemo(() => file.uuid === undefined, [file.uuid]);

    const textColor = useMemo(
      () => (file.step === 'error' || file.step === 'cancel' ? 'text-destructive' : 'text-[#6A778B]'),
      [file.step]
    );
    return (
      <div className="mb-1 mt-1 flex max-w-[517px] flex-grow flex-row items-center justify-between p-1">
        <div className="min-w-0 grow">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap pr-2 text-sm font-semibold text-[#0A0F1C]">
            {fileName}
          </div>

          <div className="overflow-hidden text-ellipsis text-sm font-normal text-slate-500">{`.${extension}`}</div>
        </div>

        <div className="flex items-center gap-4">
          {state === 'Importing...' ? (
            <div className="overflow-hidden text-ellipsis text-sm font-normal text-[#3562E3]">{`${progress}%`}</div>
          ) : null}

          {state === 'Importing...' ? (
            <Progress value={progress} className="w-[100px]" />
          ) : (
            <div className={`text-sm font-normal ${textColor}`}>{state}</div>
          )}

          {state === 'Importing...' || state === 'Pending...' ? (
            <Button
              variant="ghost"
              className="w-[82px] text-primary hover:text-primary"
              disabled={file.abortController === undefined}
              onClick={() => file.abortController?.abort()}
            >
              Cancel
            </Button>
          ) : state === 'Imported' ? (
            <Link
              key={file.uuid}
              to={ROUTES.FILE({ uuid: file.uuid ?? '', searchParams: '' })}
              reloadDocument
              className={cn('relative z-10 h-full w-full', disabled && `pointer-events-none`)}
            >
              <Button variant="outline" disabled={importing || disabled} className="w-[82px]" onClick={onOpen}>
                Open
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
    );
  }
);
