import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { CursorPosition } from '@/app/ui/menus/Toolbar/CursorPosition';
import { FormattingBar } from '@/app/ui/menus/Toolbar/FormattingBar';
import { ZoomMenu } from '@/app/ui/menus/Toolbar/ZoomMenu';
import { useRecoilValue } from 'recoil';

export const Toolbar = () => {
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const { permissions } = editorInteractionState;

  return (
    <div className="flex h-8 flex-shrink-0 select-none border-b border-border">
      <div className="w-44 border-r border-border">
        <CursorPosition />
      </div>
      <div className="flex flex-grow items-stretch justify-center">
        {permissions.includes('FILE_EDIT') && <FormattingBar />}
      </div>
      <div className="flex w-44 items-center justify-end">
        <ZoomMenu />
      </div>
    </div>
  );
};
