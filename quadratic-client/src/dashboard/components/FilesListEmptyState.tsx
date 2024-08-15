import { newFileDialogAtom } from '@/dashboard/atoms/newFileDialogAtom';
import { Empty } from '@/dashboard/components/Empty';
import { FileIcon } from '@radix-ui/react-icons';
import mixpanel from 'mixpanel-browser';
import { useSetRecoilState } from 'recoil';

export const FilesListEmptyState = () => {
  const setNewFileDialogState = useSetRecoilState(newFileDialogAtom);

  return (
    <Empty
      className="max-w-xl"
      title="No files"
      description={
        <>
          You don’t have any files yet.{' '}
          <button
            className="underline hover:text-primary"
            onClick={() => {
              mixpanel.track('[FilesEmptyState].clickCreateBlankFile');
              setNewFileDialogState({ show: true });
            }}
          >
            Create a new file
          </button>
          .
        </>
      }
      Icon={FileIcon}
    />
  );
};
