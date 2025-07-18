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
    <div className="absolute bottom-4 left-4 z-50 w-96 select-none rounded border border-border bg-background pb-2 pl-4 pr-4 pt-2 tracking-tight shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <div className="min-w-0">
          <div className="font-medium">
            Importing file {fileNo} of {totalFiles}
          </div>

          <div className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-normal text-muted-foreground">
            {name}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={abortController === undefined}
          onClick={() => abortController?.abort()}
        >
          Cancel
        </Button>
      </div>

      <Progress key={fileNo} value={progress} variant="primary" />
    </div>
  );
};
