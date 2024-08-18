import { getExtension, stripExtension } from '@/app/helpers/files';
import { FileImportProgress, filesImportProgressAtom } from '@/dashboard/atoms/filesImportProgressAtom';
import { filesImportProgressListAtom } from '@/dashboard/atoms/filesImportProgressListAtom';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { Progress } from '@/shared/shadcn/ui/progress';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState } from 'recoil';

export const ImportProgressList = () => {
  const [{ show }, setShow] = useRecoilState(filesImportProgressListAtom);
  const [{ importing, files, currentFileIndex }, setFilesImportProgressState] = useRecoilState(filesImportProgressAtom);

  const handleClose = useCallback(() => {
    setShow({ show: false });
    setFilesImportProgressState({
      importing: false,
      currentFileIndex: 0,
      createNewFile: false,
      files: [],
    });
  }, [setFilesImportProgressState, setShow]);

  if (!show) return;

  return (
    <div className="absolute left-0 top-0 z-10 flex h-full w-full flex-col items-center overflow-hidden bg-white bg-opacity-90">
      <div className="z-10 mb-12 mt-12 w-[565px] select-none rounded-sm border border-slate-200 bg-white p-6 tracking-tight shadow-[0_4px_8px_0px_rgba(0,0,0,0.15)]">
        <div className="pb-4 text-lg font-semibold">Import files</div>

        <div className="flex max-h-[75vh] w-full flex-col overflow-y-auto">
          {files.map((file, index) => (
            <ImportProgressItem
              file={file}
              index={index}
              current={currentFileIndex}
              importing={importing}
              key={index}
              handleClose={handleClose}
            />
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <Button disabled={importing} onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

const ImportProgressItem = ({
  file,
  index,
  current,
  importing,
  handleClose,
}: {
  file: FileImportProgress;
  index: number;
  current: number;
  importing: boolean;
  handleClose: () => void;
}) => {
  const navigate = useNavigate();

  const handleOpen = useCallback(() => {
    handleClose();
    if (file.uuid !== undefined) {
      navigate(ROUTES.FILE(file.uuid));
    }
  }, [file.uuid, handleClose, navigate]);

  const fileName = stripExtension(file.name);
  const extension = getExtension(file.name);
  const progress = Math.round(file.progress);
  const abortController = file.abortController;

  const state =
    file.step === 'error'
      ? 'Import failed'
      : file.step === 'cancel'
      ? 'Import canceled'
      : file.step === 'done'
      ? 'Imported'
      : file.step === 'read' && current < index
      ? 'Pending...'
      : 'Importing...';

  const textColor = file.step === 'error' || file.step === 'cancel' ? 'text-destructive' : 'text-[#6A778B]';
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
            disabled={abortController === undefined}
            onClick={() => abortController?.abort()}
          >
            Cancel
          </Button>
        ) : state === 'Imported' ? (
          <Button
            variant="outline"
            disabled={importing || file.uuid === undefined}
            className="w-[82px]"
            onClick={handleOpen}
          >
            Open
          </Button>
        ) : null}
      </div>
    </div>
  );
};
