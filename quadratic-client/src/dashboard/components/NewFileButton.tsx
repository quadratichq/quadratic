import { newFileDialogAtom } from '@/dashboard/atoms/newFileDialogAtom';
import { Button } from '@/shared/shadcn/ui/button';
import { useSetRecoilState } from 'recoil';

export default function NewFileButton() {
  const setNewFileDialogState = useSetRecoilState(newFileDialogAtom);

  return (
    <Button
      onClick={() => {
        setNewFileDialogState({ show: true });
      }}
    >
      New file
    </Button>
  );
}
