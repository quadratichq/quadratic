import { newFileDialogAtom } from '@/dashboard/atoms/newFileDialogAtom';
import { Empty } from '@/dashboard/components/Empty';
import { FileIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import { useSetRecoilState } from 'recoil';

export const FilesListEmptyState = ({ isPrivate = false }: { isPrivate?: boolean }) => {
  const setNewFileDialogState = useSetRecoilState(newFileDialogAtom);

  return (
    <div className="flex min-h-80 items-center justify-center border-2 border-dashed border-border">
      <Empty
        className="max-w-lg"
        title="No files"
        description={
          <>
            You don’t have any files yet.{' '}
            <button
              className="underline hover:text-primary"
              onClick={() => {
                mixpanel.track('[FilesEmptyState].clickCreateBlankFile');
                setNewFileDialogState({ show: true, isPrivate });
              }}
            >
              Create a new file
            </button>{' '}
            or drag and drop a CSV, Excel, Parquet, or Quadratic file here.
          </>
        }
        Icon={FileIcon}
      />
    </div>
  );
};
