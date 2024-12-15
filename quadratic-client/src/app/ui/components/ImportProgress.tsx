import { filesImportProgressAtom } from '@/dashboard/atoms/filesImportProgressAtom';
import { Button } from '@/shared/shadcn/ui/button';
import { Progress } from '@/shared/shadcn/ui/progress';
import { useRecoilValue } from 'recoil';

export const ImportProgress = () => {
  const { importing, files, currentFileIndex } = useRecoilValue(filesImportProgressAtom);
  if (!importing || currentFileIndex === undefined) return;

  const fileNo = currentFileIndex + 1;
  const totalFiles = files.length;
  const name = files[currentFileIndex].name;
  const progress = files[currentFileIndex].progress;
  const abortController = files[currentFileIndex].abortController;

  return (
    <div className="fixed bottom-16 left-8 z-50 h-[92px] w-[403px] select-none border border-slate-200 bg-white pb-2 pl-4 pr-4 pt-2 tracking-tight shadow-[0_2px_5px_0px_rgba(0,0,0,0.15)]">
      <div className="flex justify-between">
        <div className="min-w-0">
          <div className="text-base font-medium">
            Importing file {fileNo} of {totalFiles}
          </div>

          <div className="overflow-hidden text-ellipsis whitespace-nowrap pb-2 text-sm font-normal text-slate-500">
            {name}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-primary hover:text-primary"
          disabled={abortController === undefined}
          onClick={() => abortController?.abort()}
        >
          Cancel
        </Button>
      </div>

      <Progress key={fileNo} value={progress} />
    </div>
  );
};
