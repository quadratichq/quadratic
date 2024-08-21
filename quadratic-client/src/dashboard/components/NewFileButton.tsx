import { newFileDialogAtom } from '@/dashboard/atoms/newFileDialogAtom';
import { Button } from '@/shared/shadcn/ui/button';
import { useSetRecoilState } from 'recoil';

export default function NewFileButton({ isPrivate }: { isPrivate: boolean }) {
  const setNewFileDialogState = useSetRecoilState(newFileDialogAtom);

  return (
    <Button
      onClick={() => {
        setNewFileDialogState({ show: true, isPrivate });
      }}
    >
      New file
    </Button>
  );
}
